// ⑦ HMI 설비 현황판 — 렌더 · 설비 가동 켬 → 30칸 값 갱신 → 끔 · 반응형(1280×720 · 1440×900 · 1920×1080 · 2560×1440 페이지 스크롤 0 · 가로 넘침 0 · 잘린 상자 0 · 1024×768은 가로 스크롤 0만)
// 정본 docs/08_screen/11_hmi_screen.md §HMI-PLANT. api(13000)에 카드 라인 30대가 시드돼 있어야 한다(task up SEED="--card-line").
// 설비 가동은 꺼진 게 기본이다 — 켜는 시험은 끝나면 반드시 끈다(지우기 · 다른 spec이 꺼진 상태를 전제로 한다). 데이터 지우기는 누르지 않는다.
import { expect, type Page, test } from '@playwright/test';
import {
  API,
  expectFits,
  expectNoSideScroll,
  FIT_VIEWPORTS,
  SMALL_VIEWPORT,
  shot,
  waitForScreen,
} from './support';

const TITLE = '카드 생산 라인 3개, 설비 30대 지금 상태';

/** 설비 가동을 api로 바로 바꾼다(화면 조작 없이 — 준비 · 정리용) */
async function setPower(on: boolean): Promise<void> {
  const res = await fetch(`${API}/api/v1/plant/power`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ on }),
  });
  if (!res.ok) throw new Error(`POST plant/power → ${res.status} ${await res.text()}`);
}

/** 개요가 그려졌다는 표지 — 스켈레톤이 아니라 30칸 */
async function ready(page: Page): Promise<void> {
  await expect(page.getByTestId('device-tile')).toHaveCount(30);
  await expect(page.getByTestId('device-detail')).toBeVisible();
}

/** 30칸의 핵심 값 글자 — 갱신 비교용 */
const tileValues = (page: Page): Promise<string[]> => page.getByTestId('tile-value').allTextContents();

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(async () => {
  await setPower(false);
});

test.afterAll(async () => {
  await setPower(false);
});

test('⑦ 렌더 — 라인 3 × 공정 10 · 요약(상태 4 · 초당 개수 · 종류 8) · 고른 설비 자세히 · 머리 컨트롤 2', async ({
  page,
}, info) => {
  await page.goto('/hmi');
  await ready(page);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(TITLE);
  // 머리 오른쪽 공용 컨트롤 — 설비 가동 스위치 · 데이터 지우기(누르지 않는다)
  await expect(page.getByRole('switch', { name: '설비 가동' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('purge').getByRole('button', { name: '데이터 지우기' })).toBeVisible();
  // 라인 판 — 공정 열 머리 10(인쇄 → 포장) · 라인 3 · 꺼짐이면 30칸 모두 정지 + 안내 띠
  await expect(page.getByTestId('process-head')).toHaveCount(10);
  await expect(page.getByTestId('process-head').first()).toHaveText('인쇄');
  await expect(page.getByTestId('process-head').last()).toHaveText('포장');
  await expect(page.getByTestId('line-label')).toHaveText(['라인 1', '라인 2', '라인 3']);
  await expect(page.locator('[data-testid="device-tile"][data-state="stopped"]')).toHaveCount(30);
  await expect(page.getByTestId('power-off')).toContainText('설비 가동이 꺼져 있어요');
  // 요약 — 상태 4 · 종류 8(꺼짐이면 주기 기준 비율)
  await expect(page.getByTestId('state-count')).toHaveCount(4);
  await expect(page.locator('[data-testid="kind-mix"] li')).toHaveCount(8);
  await expect(page.getByTestId('kind-mix')).toHaveAttribute('data-basis', 'period');
  // 자세히 — 첫 설비 · 출처 표지 3(지금 값 Redis · 최근 10분 ClickHouse · 설비 정보 PostgreSQL) · 멈춘 값 표지
  await expect(page.getByTestId('device-detail')).toHaveAttribute('data-device', 'L1-PRT');
  await expect(page.locator('[data-testid="hmi-sources"] li')).toHaveCount(3);
  await expect(page.getByTestId('stale-note')).toBeVisible();
  // 칸을 누르면 자세히가 그 설비로 바뀐다 — 라미네이팅은 태그 5(온도 2 · 압력 · 수량 · 상태)
  await page.locator('[data-testid="device-tile"][data-device="L2-LAM"]').click();
  await expect(page.locator('[data-testid="device-tile"][data-device="L2-LAM"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('device-detail')).toHaveAttribute('data-device', 'L2-LAM');
  await expect(page.getByTestId('tag-row')).toHaveCount(5);
  // 알람 · 원격 조작은 없다(D-16)
  await expect(page.locator('[data-screen="hmi"]')).not.toContainText(/알람|원격/);
  await shot(page, info, 'hmi-off');
});

test('⑦ 설비 가동 켬 → 30칸 값이 1초마다 갱신 → 끔 → 30칸 정지', async ({ page }, info) => {
  await page.goto('/hmi');
  await ready(page);
  const power = page.getByRole('switch', { name: '설비 가동' });
  try {
    await expect(power).toBeEnabled();
    await power.click();
    await expect(power).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });
    await expect(page.getByTestId('plant-power-state')).toHaveText('켜짐');
    // 수집기가 1초마다 보고 시작한다 — 몇 초 안에 대부분 가동(통신 중) · 안내 띠가 사라진다
    await expect
      .poll(() => page.locator('[data-testid="device-tile"][data-state="running"]').count(), {
        timeout: 30_000,
      })
      .toBeGreaterThan(10);
    await expect(page.getByTestId('power-off')).toHaveCount(0);
    await expect(page.getByTestId('hmi-pps')).not.toContainText(/초당\s*0\s*개/);
    await expect(page.getByTestId('kind-mix')).toHaveAttribute('data-basis', 'live');
    // 30칸 값이 실제로 바뀐다(개요 1초 주기) — 두 번 읽어 다른지
    const before = await tileValues(page);
    expect(before).toHaveLength(30);
    await expect
      .poll(async () => (await tileValues(page)).join('|'), { timeout: 10_000 })
      .not.toBe(before.join('|'));
    // 고른 설비 최근 10분 — ClickHouse에서 5초 안에 작은 선이 그려진다
    await page.locator('[data-testid="device-tile"][data-device="L1-MIL"]').click();
    await expect(page.getByTestId('device-detail')).toHaveAttribute('data-device', 'L1-MIL');
    await expect(page.locator('[data-testid="tag-row"] [role="img"]').first()).toBeVisible({
      timeout: 15_000,
    });
    await waitForScreen(page, 'hmi', 500);
    await expectFits(page, 'hmi 켜짐 1440×900');
    await shot(page, info, 'hmi-on');

    await power.click();
    await expect(power).toHaveAttribute('aria-checked', 'false', { timeout: 15_000 });
    await expect(page.getByTestId('power-off')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="device-tile"][data-state="stopped"]')).toHaveCount(30, {
      timeout: 10_000,
    });
    await shot(page, info, 'hmi-off-again');
  } finally {
    await setPower(false);
  }
});

for (const vp of FIT_VIEWPORTS)
  test(`⑦ 반응형 ${vp.width}×${vp.height} — 페이지 스크롤 0 · 가로 넘침 0 · 잘린 상자 0(태그 목록만 안에서 스크롤)`, async ({
    page,
  }, info) => {
    await page.setViewportSize(vp);
    await page.goto('/hmi');
    await ready(page);
    // 태그가 가장 많은 설비(5)를 골라 자세히 목록이 꽉 찬 때로 잰다
    await page.locator('[data-testid="device-tile"][data-device="L1-LAM"]').click();
    await expect(page.getByTestId('tag-row')).toHaveCount(5);
    await waitForScreen(page, 'hmi');
    await expectFits(page, `hmi ${vp.width}×${vp.height}`);
    await shot(page, info, `hmi-${vp.width}x${vp.height}`);
  });

test('⑦ 작은 화면 1024×768 — 한 줄로 쌓고 세로 스크롤만(가로 넘침 0)', async ({ page }, info) => {
  await page.setViewportSize(SMALL_VIEWPORT);
  await page.goto('/hmi');
  await ready(page);
  await waitForScreen(page, 'hmi', 800);
  await expectNoSideScroll(page, 'hmi 1024×768');
  await shot(page, info, 'hmi-small');
});
