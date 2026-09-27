// EXP-PERF 실행 패널 — 실제 api로 perf 실행(최대 10^5) 시작 → 진행 · 경과 · 단계 → 완료 띠 · 결과 표 · 라이브 계열
// 정본 docs/08_screen/08_evidence_screens.md §EXP-PERF 요소 실행 패널 행 · §실행 패널 — 두 화면 공통 규칙
import { expect, test } from '@playwright/test';
import { currentRun, elapsedSec, kstClock, settleRuns, shot } from './support';

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => settleRuns());
test.afterEach(() => settleRuns());

test('최대 10^5 시작 → 실행 중 → 완료 띠(KST) · 단계 전부 done · 결과 표 · 라이브 계열 · 시작 재활성', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  await page.goto('/experiments/perf');
  const panel = page.getByTestId('run-panel-perf');
  const start = panel.getByRole('button', { name: '시작', exact: true });
  await expect(start).toBeEnabled(); // current를 받은 뒤에만 켜진다
  await panel.getByRole('button', { name: '10^5', exact: true }).click();
  await expect(panel.getByRole('button', { name: '10^5', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const posted = page.waitForRequest(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/bff/runs',
  );
  await start.click();
  const req = await posted;
  expect(req.postDataJSON()).toEqual({ type: 'perf', params: { maxExponent: 5 } });
  expect((await req.response())?.status()).toBe(202);

  const status = panel.getByTestId('run-status');
  const elapsed = panel.getByTestId('run-elapsed');
  const steps = panel.getByTestId('run-steps').locator('li');
  await expect(status).toHaveText('실행 중');
  await expect(start).toBeDisabled();
  await expect(panel.getByRole('button', { name: '중단', exact: true })).toBeEnabled();
  await expect(panel.getByRole('button', { name: '10^5', exact: true })).toBeDisabled(); // 진행 중 매개변수 잠금
  await shot(page, info, 'perf-running');

  // 단계 상태를 따라가며 기록 — 차례(done은 앞에서부터 · running은 많아야 하나) · 경과 증가
  const seen: string[][] = [];
  const elapsedSeen: number[] = [];
  for (;;) {
    const s = await status.textContent();
    const titles = await steps.evaluateAll((els) =>
      els.map((li) => li.querySelector('span[title]')?.getAttribute('title') ?? ''),
    );
    seen.push(titles);
    if (s !== '실행 중' && s !== '중단 중') break;
    elapsedSeen.push(elapsedSec((await elapsed.textContent()) ?? ''));
    await page.waitForTimeout(250);
  }
  await expect(status).toHaveText('완료');
  for (const t of seen) {
    expect(t.filter((x) => x === 'running').length, `running은 하나 이하 ${t}`).toBeLessThanOrEqual(1);
    const firstNotDone = t.findIndex((x) => x !== 'done');
    if (firstNotDone >= 0)
      expect(
        t.slice(firstNotDone + 1).every((x) => x === 'pending' || x === 'skipped'),
        `단계는 차례로 진행 ${t}`,
      ).toBe(true);
  }
  expect(seen.at(-1)?.every((x) => x === 'done' || x === 'skipped')).toBe(true);
  expect(seen.at(-1)?.length ?? 0).toBeGreaterThanOrEqual(4); // prepare · fill-ch · fill-pg · query · cleanup
  info.annotations.push({ type: 'elapsed ticks', description: elapsedSeen.join(',') });

  // 완료 띠 — "완료 — 총 소요 N초 · 종료 HH:MM:SS KST" · 종료 시각은 api endedAt(UTC Z)을 KST로
  const run = await currentRun();
  expect(run?.status).toBe('completed');
  const band = panel.getByTestId('run-band');
  await expect(band).toHaveText(/^완료 — 총 소요 (\d+분 )?\d+(\.\d)?초 · 종료 \d{2}:\d{2}:\d{2} KST$/);
  await expect(band).toContainText(`종료 ${kstClock(run?.endedAt as string)}`);
  // 소요 = endedAt − startedAt(0.1초 버림)
  const took = (Date.parse(run?.endedAt as string) - Date.parse(run?.startedAt as string)) / 1000;
  expect(Math.abs(elapsedSec((await band.textContent()) ?? '') - took)).toBeLessThan(0.2);
  await expect(panel.getByText(`시작 ${kstClock(run?.startedAt as string)}`)).toBeVisible();

  // 결과 표 · 라이브 계열(곡선 설명 줄 · 범례는 캔버스)
  await expect(panel.getByText('결과 표')).toBeVisible();
  await expect(panel.locator('table')).toBeVisible();
  await expect(panel.locator('table')).toContainText('CH');
  await expect(page.getByText('라이브 실행(시연값', { exact: false })).toBeVisible();

  // 완료 뒤 시작 재활성 · 중단 비활성 · 매개변수 잠금 해제
  await expect(start).toBeEnabled();
  await expect(panel.getByRole('button', { name: '중단', exact: true })).toBeDisabled();
  await panel.scrollIntoViewIfNeeded();
  await shot(page, info, 'perf-completed');
  await page.getByText('규모 곡선 —', { exact: false }).scrollIntoViewIfNeeded();
  await shot(page, info, 'perf-live-series');
});

// 10^5 실행은 0.6초 안팎이라 1초 폴링으로는 중간 상태가 화면에 남지 않는다 — 진행 관찰은 3초 안팎인 10^6으로 본다
test('최대 10^6 — 진행 중 경과가 1초 틱으로 늘고 단계가 앞에서부터 차례로 done이 된다', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  await page.goto('/experiments/perf');
  const panel = page.getByTestId('run-panel-perf');
  const start = panel.getByRole('button', { name: '시작', exact: true });
  await expect(start).toBeEnabled();
  await panel.getByRole('button', { name: '10^6', exact: true }).click();
  await start.click();
  const status = panel.getByTestId('run-status');
  await expect(status).toHaveText('실행 중');

  const elapsed = panel.getByTestId('run-elapsed');
  const steps = panel.getByTestId('run-steps').locator('li span[title]');
  const elapsedSeen: string[] = [];
  const doneSeen: number[] = [];
  for (;;) {
    const s = await status.textContent();
    if (s !== '실행 중' && s !== '중단 중') break;
    const titles = await steps.evaluateAll((els) => els.map((e) => e.getAttribute('title') ?? ''));
    const firstNotDone = titles.findIndex((x) => x !== 'done');
    if (firstNotDone >= 0)
      expect(
        titles.slice(firstNotDone + 1).every((x) => x === 'pending'),
        `단계는 차례로 진행 ${titles}`,
      ).toBe(true);
    doneSeen.push(titles.filter((x) => x === 'done').length);
    elapsedSeen.push((await elapsed.textContent()) ?? '');
    await page.waitForTimeout(200);
  }
  await expect(status).toHaveText('완료');
  info.annotations.push({ type: 'elapsed', description: [...new Set(elapsedSeen)].join(' → ') });
  info.annotations.push({ type: 'done counts', description: [...new Set(doneSeen)].join(' → ') });
  // 진행 중 경과가 적어도 한 번 올라갔다(틱) · done 수가 진행 중에 늘었다(차례로)
  const secs = elapsedSeen.map(elapsedSec);
  expect(Math.max(...secs)).toBeGreaterThan(Math.min(...secs));
  expect(new Set(doneSeen).size).toBeGreaterThanOrEqual(2);
  for (let i = 1; i < doneSeen.length; i++)
    expect(doneSeen[i] as number).toBeGreaterThanOrEqual(doneSeen[i - 1] as number);
  await expect(panel.getByTestId('run-band')).toHaveText(/^완료 — 총 소요 /);
  await shot(page, info, 'perf-1e6-completed');
});
