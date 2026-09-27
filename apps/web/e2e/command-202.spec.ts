// 업무 쓰기 명령 경로의 202 · 503 표시 — 브라우저에서 BFF 쓰기 응답과 명령 조회를 가로채 만든다(실제 쓰기는 일어나지 않는다)
// 정본 docs/08_screen/01_standards.md §업무 쓰기 응답 — 명령 경로 · 07_api/01 §업무 쓰기 경로 · §명령 조회 표면
import { randomUUID } from 'node:crypto';
import { expect, type Page, type Route, test } from '@playwright/test';
import { apiGet, IDEMPOTENCY, runSuffix, shot } from './support';

const DEVICE_ID = 2;
type Dev = {
  deviceId: number;
  lineId: number;
  deviceCode: string;
  deviceName: string;
  vendor: string | null;
  model: string | null;
  isActive: boolean;
};

async function seedDevice(): Promise<Dev> {
  const d = (await apiGet<{ items: Dev[] }>('devices?siteId=1&includeInactive=true')).items.find(
    (x) => x.deviceId === DEVICE_ID,
  );
  if (!d) throw new Error(`시드 설비 ${DEVICE_ID}가 없다`);
  return d;
}

const isDevicePatch = (route: Route) =>
  route.request().method() === 'PATCH' &&
  new URL(route.request().url()).pathname === `/bff/master/devices/${DEVICE_ID}`;

async function openDevice(page: Page, device: Dev) {
  await page.goto(`/admin/master/devices/${DEVICE_ID}`);
  await expect(page.getByLabel('설비명', { exact: true })).toHaveValue(device.deviceName);
}

test('202 pending → "적용 대기" 폼 잠금 → 명령 조회 pending · applied → 저장 안내', async ({
  page,
}, info) => {
  const device = await seedDevice();
  const renamed = `E2E-${runSuffix()} 가로챔`;
  const cmdId = randomUUID();
  let sentKey: string | undefined;
  await page.route(`**/bff/master/devices/${DEVICE_ID}`, async (route) => {
    if (!isDevicePatch(route)) return route.continue();
    sentKey = route.request().headers()[IDEMPOTENCY];
    await route.fulfill({
      status: 202,
      headers: { 'content-type': 'application/json', [IDEMPOTENCY]: sentKey ?? cmdId },
      body: JSON.stringify({ cmdId, status: 'pending' }),
    });
  });
  const polls: string[] = [];
  await page.route('**/bff/commands/*', async (route) => {
    polls.push(route.request().url());
    const applied = polls.length >= 2;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        applied
          ? { cmdId, status: 'applied', httpStatus: 200, result: { ...device, deviceName: renamed } }
          : { cmdId, status: 'pending' },
      ),
    });
  });

  await openDevice(page, device);
  await page.getByLabel('설비명', { exact: true }).fill(renamed);
  await page.getByRole('button', { name: '저장', exact: true }).click();

  // 적용 대기 — 저장 버튼 자리 문구 · 폼 영역 띠 · 폼 잠금(같은 폼 재제출 막음) · 입력 유지
  const pendingBtn = page.getByRole('button', { name: '적용 대기 — 명령 접수됨' });
  await expect(pendingBtn).toBeVisible();
  await expect(pendingBtn).toBeDisabled();
  await expect(page.getByRole('button', { name: '사용 중지' })).toBeDisabled();
  const notice = page.locator('[data-command-phase="pending"]');
  await expect(notice).toContainText(`적용 대기 — 명령 접수됨 (${cmdId.slice(0, 8)})`);
  await expect(notice).toContainText('다시 저장하지 않는다');
  await expect(page.getByLabel('설비명', { exact: true })).toHaveValue(renamed);
  // 202는 성공이 아니다 — 저장 안내가 없다
  await expect(page.getByText('저장했다', { exact: false })).toHaveCount(0);
  await shot(page, info, '202-pending');

  // 명령 조회 pending → applied — 잠금 해제 · 기존 성공 처리(저장 안내)
  await expect(
    page.getByText('저장했다 — 다른 화면의 설비 선택기는 신호(cache:devlist)로 갱신된다'),
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[data-command-phase]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '사용 중지' })).toBeEnabled();
  expect(polls.length).toBeGreaterThanOrEqual(2);
  expect(new URL(polls[0] as string).pathname).toBe(`/bff/commands/${cmdId}`);
  expect(sentKey).toBeTruthy();
  await shot(page, info, '202-applied');
});

test('쓰기 503 → "업무 쓰기 저장소 응답 불가" 띠 · 입력 유지 · 재시도는 같은 키', async ({ page }, info) => {
  const device = await seedDevice();
  const renamed = `E2E-${runSuffix()} 503`;
  const keys: string[] = [];
  await page.route(`**/bff/master/devices/${DEVICE_ID}`, async (route) => {
    if (!isDevicePatch(route)) return route.continue();
    const key = route.request().headers()[IDEMPOTENCY] ?? '';
    keys.push(key);
    if (keys.length === 1)
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'common.postgres_unavailable', message: '업무 저장소 응답 불가' },
        }),
      });
    // 재시도는 적용된 것으로 돌려준다(실제 쓰기 없음)
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', [IDEMPOTENCY]: key },
      body: JSON.stringify({ ...device, deviceName: renamed }),
    });
  });

  await openDevice(page, device);
  await page.getByLabel('설비명', { exact: true }).fill(renamed);
  await page.getByRole('button', { name: '저장', exact: true }).click();

  const band = page.locator('[data-command-phase="retryable"]');
  await expect(band).toContainText('업무 쓰기 저장소 응답 불가 — 조회는 된다 · 같은 키로 다시 보내면 안전');
  // 목록 · 상세 유지 · 폼 입력 유지 · 잠금 없음
  await expect(page.getByLabel('설비명', { exact: true })).toHaveValue(renamed);
  await expect(page.getByRole('link', { name: `● ${device.deviceName}`, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
  await shot(page, info, '503-band');

  await band.getByRole('button', { name: '같은 키로 다시 보내기' }).click();
  await expect(page.getByText('저장했다', { exact: false })).toBeVisible();
  await expect(page.locator('[data-command-phase]')).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBeTruthy();
  expect(keys[1], '503 뒤 재시도는 같은 Idempotency-Key').toBe(keys[0]);
  await shot(page, info, '503-retried');
});
