// EXP-FLOW 직접 보내 보기 — 실제 api로 flow 실행(pps 1000 · 30초 · 업무 1/초 · 조회 20/초) 시작 → 진행 띠 · 흐름도 · 숫자 · 조회 줄에 보임 → 중단
// 설계 .omc/plans/web-junior-redesign.md §3 직접 보내 보기 행(머리 버튼 → 보낼 양 → 진행 띠 한 줄 · 결과는 흐름도가 바로 보여 준다 · 서랍 없음)
import { expect, test } from '@playwright/test';
import { currentRun, settleRuns, shot } from './support';

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: 'serial' });
test.beforeEach(() => settleRuns());
test.afterEach(() => settleRuns());

test('pps 1000 · 30초 · 업무 1/초 · 조회 20/초 시작 → 진행 증가 · 흐름도에 직접 보낸 몫 · 업무 요청 > 0 · 조회 줄 > 0 · 띠가 있어도 스크롤 0 → 중단 → 중단됨 띠', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.goto('/monitoring');
  await expect(page.getByTestId('ws-indicator')).toContainText('실시간 연결됨');
  const control = page.getByTestId('run-control-flow');
  await control.getByRole('button', { name: '직접 보내 보기' }).click();
  const pop = control.getByRole('dialog');
  const start = pop.getByRole('button', { name: '시작', exact: true });
  await expect(start).toBeEnabled();
  // 조회 요청(초당) 선택지 — 0 · 5 · 20(기본) · 50 · 쉬운 말(0은 "안 보냄")
  for (const v of ['안 보냄', '5/초', '20/초', '50/초'])
    await expect(pop.getByRole('button', { name: v, exact: true })).toBeVisible();
  await expect(pop.getByRole('button', { name: '20/초', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  for (const v of ['1,000', '30초', '1/초', '20/초']) {
    await pop.getByRole('button', { name: v, exact: true }).click();
    await expect(pop.getByRole('button', { name: v, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }

  const posted = page.waitForRequest(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/bff/runs',
  );
  await start.click();
  const req = await posted;
  expect(req.postDataJSON()).toEqual({
    type: 'flow',
    params: { pps: 1000, durationSec: 30, bizPerSec: 1, readsPerSec: 20 },
  });
  expect((await req.response())?.status()).toBe(202);

  const status = control.getByTestId('run-status');
  await expect(status).toHaveText('실행 중');

  // 진행 띠 한 줄 — 보내는 진행 막대 증가
  const strip = page.getByTestId('run-progress-strip');
  const bar = strip.getByRole('progressbar');
  await expect(bar).toBeVisible();
  const pct = async () => Number(await bar.getAttribute('aria-valuenow'));
  const p0 = await pct();
  await expect.poll(pct, { timeout: 10_000, message: '진행 % 증가' }).toBeGreaterThan(p0);

  // 결과는 흐름도가 바로 보여 준다 — 공장 센서 노드 툴팁에 직접 보낸 몫 · 업무 요청 초당 > 0
  const diagram = page.getByTestId('flow-diagram');
  // 직접 보내 보기 몫은 공장 센서 노드 툴팁(SVG title)에 — 노드 숫자는 다른 센서 숫자와 같은 원천(흐름 요약 10초)
  await expect(diagram.locator('[data-node="src"] > title')).toContainText('직접 보내 보기 몫', {
    timeout: 15_000,
  });
  const bizNum = async () => {
    const t =
      (await page.getByTestId('flow-headline').locator('[data-key="biz"] [data-value]').textContent()) ?? '';
    return /^[\d,.]+$/.test(t) ? Number(t.replace(/,/g, '')) : 0;
  };
  await expect.poll(bizNum, { timeout: 15_000, message: '업무 요청 초당 > 0' }).toBeGreaterThan(0);

  // 조회 줄 — 메트릭 5초 차분이라 폴링 두 번 뒤에 값이 생긴다 · 조회 요청 노드 초당 > 0 · ⑤ 비율이 숫자 · 줄기 라벨이 DB별 %
  const readNum = async () => {
    const t = (await diagram.locator('[data-node="readSrc"]').textContent()) ?? '';
    const m = /초당 ([\d,.]+)건/.exec(t);
    return m?.[1] ? Number(m[1].replace(/,/g, '')) : 0;
  };
  await expect.poll(readNum, { timeout: 20_000, message: '조회 요청 초당 > 0' }).toBeGreaterThan(0);
  await expect(diagram.locator('[data-node="readCache"]')).toContainText(/있으면 바로 응답 (\d+%|1% 미만)/);
  await expect(diagram.locator('[data-edge="read-miss"]')).toContainText(
    /ClickHouse\(센서\) (\d+%|1% 미만) · PostgreSQL\(업무 목록\) (\d+%|1% 미만)/,
  );

  // 진행 띠가 생겨도 한 장 — 흐름도가 줄어 흡수한다(본문 스크롤 0)
  const body = page.locator('[data-shell="content-body"]');
  const m = await body.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
  expect(m.sh).toBeLessThanOrEqual(m.ch + 1);
  await expect(page.getByTestId('flow-footnote')).toBeInViewport({ ratio: 1 });
  // 띠가 있어도 흐름도 배율 1.0(가로가 먼저 찬다 — viewBox 1126 × 440 · 안쪽 1126 × 452) — 노드 글자 12 ~ 14px가 화면 크기 그대로
  const scale = await diagram.evaluate((el) => {
    const svg = el as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    return Math.min(r.width / svg.viewBox.baseVal.width, r.height / svg.viewBox.baseVal.height);
  });
  expect(scale, '진행 띠가 있어도 흐름도 배율 1.0').toBeGreaterThanOrEqual(0.999);
  await shot(page, info, 'flow-running');

  // 중단 — 진행 띠 오른쪽
  const stop = strip.getByRole('button', { name: '중단', exact: true });
  await expect(stop).toBeEnabled();
  await stop.click();
  // 종결 — 머리 칩은 숨고 띠가 "지난번 보내 보기 · 중단됨 — 걸린 시간 …"을 말한다 · 중단 버튼도 없다
  await expect(page.getByTestId('run-band')).toHaveText(/^중단됨 — 걸린 시간 /, { timeout: 30_000 });
  const run = await currentRun();
  expect(run?.status).toBe('stopped');
  await expect(status).toHaveCount(0);
  await expect(strip).toContainText('지난번 보내 보기');
  await expect(stop).toHaveCount(0);
  // 서랍 없음 — 실행 단계 · 실행 결과 서랍을 두지 않는다
  await expect(page.getByRole('button', { name: /실행 단계|실행 결과/ })).toHaveCount(0);
  await shot(page, info, 'flow-stopped');
});
