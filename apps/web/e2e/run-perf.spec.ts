// EXP-PERF 직접 재 보기 — 실제 api로 perf 실행(최대 10만 · 100만 행) 시작 → 진행 띠 한 줄(상태 · 쉬운 단계 문장 · 단계 n/m · 경과 · 중단) → 완료 띠 → 그림 2 "내 측정" 점
// 설계 .omc/plans/web-junior-redesign.md §2 직접 재 보기 행 · 정본 docs/08_screen/08_evidence_screens.md §실행 패널 — 두 화면 공통 규칙(버튼 상태 · 종결 표시 · 경과)
// 배치 — 셸 머리 "▶ 내 컴퓨터에서 직접 재 보기" · 상태 칩 → 규모 팝오버(쉬운 말) → 머리 아래 진행 띠 한 줄. 서랍 · 단계 목록 · 라이브 결과 표는 없다.
import { expect, type Page, test } from '@playwright/test';
import { currentRun, elapsedSec, settleRuns, shot } from './support';

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1440, height: 900 } });
test.beforeEach(() => settleRuns());
test.afterEach(() => settleRuns());

const BUTTON = '내 컴퓨터에서 직접 재 보기';

/** 머리 조작부 · 팝오버 · 진행 띠 */
function perfRun(page: Page) {
  const control = page.getByTestId('run-control-perf');
  const popover = control.getByRole('dialog', { name: '측정 매개변수' });
  const strip = page.getByTestId('run-progress-strip');
  return {
    control,
    popover,
    measure: control.getByRole('button', { name: BUTTON }),
    open: async () => {
      if (!(await popover.isVisible())) await control.getByRole('button', { name: BUTTON }).click();
      await expect(popover).toBeVisible();
    },
    start: popover.getByRole('button', { name: '시작', exact: true }),
    stop: strip.getByRole('button', { name: '중단', exact: true }),
    status: control.getByTestId('run-status'),
    strip,
    stage: page.getByTestId('run-stage'),
    elapsed: page.getByTestId('run-elapsed'),
    band: page.getByTestId('run-band'),
  };
}

/** 본문 스크롤 없음 — 진행 띠가 생겨도 그림 2가 흡수한다(§5 픽셀 예산) */
async function expectNoScroll(page: Page) {
  const m = await page
    .locator('[data-shell="content-body"]')
    .evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  expect(m.sh, `본문 세로 스크롤 ${m.sh} > ${m.ch}`).toBeLessThanOrEqual(m.ch + 1);
}

test('10만 행 시작 → 실행 중(쉬운 단계 문장) → "지난번 직접 재 보기" 완료 띠 · 10만 행까지 · 내 측정(참고용) · 중단 버튼 없음 · 시작 재활성 · 스크롤 없음', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  await page.goto('/performance');
  const r = perfRun(page);
  await expect(r.measure).toBeEnabled(); // current를 받은 뒤에만 팝오버를 연다
  await r.open();
  // 팝오버 — 쉬운 설명 · 규모는 "10만 행 · 100만 행 · 1천만 행 · 1억 행" · 1억 행만 경고
  await expect(r.popover).toContainText('같은 질문 5개를 두 DB에 3번씩 시켜 봐요');
  for (const t of ['10만 행', '100만 행', '1천만 행', '1억 행'])
    await expect(r.popover.getByRole('button', { name: new RegExp(`^${t}`) })).toBeVisible();
  await expect(r.popover).not.toContainText('10^');
  await r.popover.getByRole('button', { name: /^1억 행/ }).click();
  await expect(r.popover.getByTestId('run-large-warning')).toHaveText(
    /^⚠ 예상 디스크\(추정 상한\) PostgreSQL .+ · ClickHouse .+ — 수 분 이상 걸려요$/,
  );
  await r.popover.getByRole('button', { name: '10만 행', exact: true }).click();
  await expect(r.popover.getByTestId('run-large-warning')).toHaveCount(0);
  await expect(r.start).toBeEnabled();

  // 시작 응답을 1.5초 늦춘다 — 응답 전에는 팝오버가 열린 채 "시작하는 중이에요…"(비활성)이고 202를 받은 뒤에만 닫힌다
  await page.route('**/bff/runs', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await new Promise((res) => setTimeout(res, 1_500));
    await route.fallback();
  });
  const posted = page.waitForRequest(
    (q) => q.method() === 'POST' && new URL(q.url()).pathname === '/bff/runs',
  );
  await r.start.click();
  const req = await posted;
  expect(req.postDataJSON()).toEqual({ type: 'perf', params: { maxExponent: 5 } });
  await expect(r.popover.getByRole('button', { name: '시작하는 중이에요…' })).toBeDisabled();
  expect((await req.response())?.status()).toBe(202);
  await expect(r.popover).toBeHidden();
  await page.unroute('**/bff/runs');

  // 진행 중 — 띠 한 줄: 쉬운 단계 문장 · 단계 n/m · 서랍 · 시작 시각 없음
  const stages: string[] = [];
  let sawRunning = false;
  for (;;) {
    // 칩은 진행 중에만 있다 — 종결 뒤에는 숨고 띠가 결과를 말한다
    const s = (await r.status.count()) > 0 ? await r.status.textContent() : null;
    if (s !== '실행 중' && s !== '멈추는 중') break;
    if (await r.stage.isVisible()) stages.push((await r.stage.textContent()) ?? '');
    if (!sawRunning) {
      sawRunning = true;
      await expect(r.stop).toBeEnabled();
      await expect(r.strip.locator('[aria-expanded]')).toHaveCount(0);
      await expect(r.strip).not.toContainText('KST');
    }
    await page.waitForTimeout(150);
  }
  await expect(r.status).toHaveCount(0);
  await expect(r.band).toHaveText(/^완료 — /);
  info.annotations.push({ type: 'stages', description: [...new Set(stages)].join(' → ') });
  for (const t of stages) {
    expect(t).toMatch(/(넣는 중|재는 중|준비 중|정리 중) · 단계 \d+\/\d+$/);
    expect(t).not.toMatch(/fill-|query@|10\^/);
  }

  // 완료 띠 — "완료 — 걸린 시간 N.N초"(툴팁 종료 KST) · 걸린 시간 = endedAt − startedAt(0.1초 버림) · 머리 칩은 숨는다
  const run = await currentRun();
  expect(run?.status).toBe('completed');
  await expect(r.band).toHaveText(/^완료 — 걸린 시간 (\d+분 )?\d+(\.\d)?초$/);
  await expect(r.band).toHaveAttribute('title', /^종료 \d{2}:\d{2}:\d{2} KST$/);
  // 무엇을 언제 잰 결과인지 — "지난번 직접 재 보기" · "10만 행까지" · 라이브 표지 · 종결 뒤 중단 버튼 없음
  await expect(r.strip).toContainText('지난번 직접 재 보기');
  await expect(r.strip.getByTestId('run-scope')).toHaveText('10만 행까지');
  await expect(r.strip.getByTestId('run-live-mark')).toHaveText('내 측정(참고용)');
  await expect(r.stop).toHaveCount(0);
  const took = (Date.parse(run?.endedAt as string) - Date.parse(run?.startedAt as string)) / 1000;
  expect(Math.abs(elapsedSec((await r.band.textContent()) ?? '') - took)).toBeLessThan(0.2);

  // 그림 2 — 내 측정 점은 캔버스 안이라 단위 시험(run-rules · perf)이 옵션으로 본다 · 여기서는 띠가 있어도 그림이 보이고 스크롤이 없음을 본다
  await expect(page.getByRole('region', { name: '그림 2' }).locator('canvas').first()).toBeVisible();
  await expectNoScroll(page);

  // 완료 뒤 시작 재활성 · 매개변수 잠금 해제
  await r.open();
  await expect(r.start).toBeEnabled();
  await expect(r.popover.getByRole('button', { name: '10만 행', exact: true })).toBeEnabled();
  await shot(page, info, 'perf-completed');
});

// 10만 행 실행은 0.6초 안팎이라 1초 폴링으로는 중간 상태가 남지 않는다 — 진행 관찰은 3초 안팎인 100만 행으로 본다
test('100만 행 — 진행 띠의 경과가 1초 틱으로 늘고 단계 n이 앞으로만 간다 · 매개변수 잠금', async ({
  page,
}, info) => {
  test.setTimeout(300_000);
  await page.goto('/performance');
  const r = perfRun(page);
  await r.open();
  await expect(r.start).toBeEnabled();
  await r.popover.getByRole('button', { name: '100만 행', exact: true }).click();
  await r.start.click();
  await expect(r.status).toHaveText('실행 중');
  await expect(r.stage).toHaveText(/ · 단계 \d+\/\d+$/);
  await r.open();
  await expect(r.start).toBeDisabled();
  await expect(r.popover.getByRole('button', { name: '100만 행', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');

  const elapsedSeen: string[] = [];
  const nSeen: number[] = [];
  for (;;) {
    // 칩은 진행 중에만 있다 — 종결 뒤에는 숨고 띠가 결과를 말한다
    const s = (await r.status.count()) > 0 ? await r.status.textContent() : null;
    if (s !== '실행 중' && s !== '멈추는 중') break;
    const st = (await r.stage.textContent().catch(() => '')) ?? '';
    const n = /단계 (\d+)\//.exec(st)?.[1];
    if (n) nSeen.push(Number(n));
    if (await r.elapsed.isVisible()) elapsedSeen.push((await r.elapsed.textContent()) ?? '');
    await page.waitForTimeout(200);
  }
  await expect(r.status).toHaveCount(0);
  await expect(r.band).toHaveText(/^완료 — /);
  info.annotations.push({ type: 'elapsed', description: [...new Set(elapsedSeen)].join(' → ') });
  info.annotations.push({ type: 'stage n', description: [...new Set(nSeen)].join(' → ') });
  const secs = elapsedSeen.map(elapsedSec);
  expect(Math.max(...secs)).toBeGreaterThan(Math.min(...secs));
  expect(new Set(nSeen).size).toBeGreaterThanOrEqual(2);
  for (let i = 1; i < nSeen.length; i++)
    expect(nSeen[i] as number).toBeGreaterThanOrEqual(nSeen[i - 1] as number);
  await expect(r.band).toHaveText(/^완료 — /);
  await shot(page, info, 'perf-1e6-completed');
});
