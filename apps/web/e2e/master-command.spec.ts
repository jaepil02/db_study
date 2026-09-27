// ADM-MASTER 업무 쓰기 — 사이트 등록(read-your-writes) · 중복 코드 409 · 설비 이름 수정과 되돌림 · Idempotency-Key 양방향
// 정본 docs/08_screen/06_master_admin.md §ADM-MASTER · 01_standards.md §업무 쓰기 응답 — 명령 경로 · 07_api/01 §업무 쓰기 경로
import { expect, type Page, type Request, test } from '@playwright/test';
import { apiGet, apiWrite, IDEMPOTENCY, runSuffix, shot } from './support';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 요청 헤더의 키가 UUID이고 응답이 같은 키를 되싣는다 */
async function expectKeyEchoed(req: Request): Promise<string> {
  const key = req.headers()[IDEMPOTENCY];
  expect(key, '요청 헤더 Idempotency-Key').toMatch(UUID);
  const res = await req.response();
  expect(res?.headers()[IDEMPOTENCY], '응답이 같은 키를 되싣는다').toBe(key);
  return key as string;
}

/** 사이트 등록 카드 — 제목과 등록 버튼을 함께 가진 가장 안쪽 div */
const siteForm = (page: Page) =>
  page
    .locator('div')
    .filter({ has: page.getByText('사이트 등록(시간대 Asia/Seoul 고정)') })
    .filter({ has: page.getByRole('button', { name: '등록', exact: true }) })
    .last();

const writeTo = (page: Page, method: string, path: string) =>
  page.waitForRequest((r) => r.method() === method && new URL(r.url()).pathname === `/bff/master/${path}`);

test('사이트 등록 → 트리에 보인다 · 같은 코드 재등록은 코드 칸 옆 "이미 있는 값"', async ({ page }, info) => {
  const sfx = runSuffix();
  const code = `E2E-${sfx}`;
  const name = `E2E 사이트 ${sfx}`;
  await page.goto('/admin/master');
  await expect(page.getByText('시뮬레이션 사이트')).toBeVisible();

  // 등록
  await page.getByRole('button', { name: '+ 사이트' }).click();
  const form = siteForm(page);
  await form.getByLabel('코드', { exact: true }).fill(code);
  await form.getByLabel('이름', { exact: true }).fill(name);
  const created = writeTo(page, 'POST', 'sites');
  await form.getByRole('button', { name: '등록', exact: true }).click();
  const req1 = await created;
  const key1 = await expectKeyEchoed(req1);
  expect((await req1.response())?.status()).toBe(201);
  // 저장 완료 — 폼이 닫히고 트리에 새 사이트(코드 · 이름)가 즉시 보인다(read-your-writes)
  await expect(page.getByText('사이트 등록(시간대 Asia/Seoul 고정)')).toHaveCount(0);
  const node = page.getByRole('button', { name: new RegExp(`${name}\\s+${code}`) });
  await expect(node).toBeVisible();
  await shot(page, info, 'site-created');

  // 같은 코드로 다시 등록 → 409 common.duplicate_key · 코드 칸 옆 문구 · 폼 입력 유지
  await page.getByRole('button', { name: '+ 사이트' }).click();
  const form2 = siteForm(page);
  await form2.getByLabel('코드', { exact: true }).fill(code);
  await form2.getByLabel('이름', { exact: true }).fill(`${name} 중복`);
  const dup = writeTo(page, 'POST', 'sites');
  await form2.getByRole('button', { name: '등록', exact: true }).click();
  const req2 = await dup;
  const key2 = await expectKeyEchoed(req2);
  expect(key2, '입력이 다른 새 제출은 새 키').not.toBe(key1);
  const res2 = await req2.response();
  if (!res2) throw new Error('중복 등록 응답 없음');
  expect(res2.status()).toBe(409);
  expect(((await res2.json()) as { error: { code: string } }).error.code).toBe('common.duplicate_key');
  await expect(form2.getByLabel(/^코드/)).toHaveValue(code);
  await expect(form2.getByText('이미 있는 값')).toBeVisible();
  await expect(form2.getByRole('button', { name: '등록', exact: true })).toBeEnabled();
  await shot(page, info, 'site-duplicate');
  // 중복 행은 생기지 않았다
  const sites = await apiGet<{ items: { siteCode: string }[] }>('sites');
  expect(sites.items.filter((s) => s.siteCode === code)).toHaveLength(1);
});

test('설비 이름 수정 → 저장 → 새 이름이 즉시 보인다 → 원래 이름으로 되돌린다', async ({ page }, info) => {
  const DEVICE_ID = 2;
  type Dev = { deviceId: number; deviceName: string };
  const before = (await apiGet<{ items: Dev[] }>('devices?siteId=1&includeInactive=true')).items.find(
    (d) => d.deviceId === DEVICE_ID,
  );
  if (!before) throw new Error(`시드 설비 ${DEVICE_ID}가 없다`);
  const original = before.deviceName;
  const renamed = `E2E-${runSuffix()} ${original}`;
  const tree = page.getByRole('link', { name: new RegExp(`^● ${original.replace(/\s/g, '\\s')}$`) });

  try {
    await page.goto(`/admin/master/devices/${DEVICE_ID}`);
    const nameInput = page.getByLabel('설비명', { exact: true });
    await expect(nameInput).toHaveValue(original);
    await expect(tree).toBeVisible();

    // 수정 → 저장
    await nameInput.fill(renamed);
    const patched = writeTo(page, 'PATCH', `devices/${DEVICE_ID}`);
    await page.getByRole('button', { name: '저장', exact: true }).click();
    const req = await patched;
    await expectKeyEchoed(req);
    expect(req.postDataJSON()).toEqual({ deviceName: renamed });
    expect((await req.response())?.status()).toBe(200);
    await expect(
      page.getByText('저장했다 — 다른 화면의 설비 선택기는 신호(cache:devlist)로 갱신된다'),
    ).toBeVisible();
    // 새 이름이 트리 · 폼에 즉시(낙관적 갱신 없이 응답 뒤 재조회로)
    await expect(page.getByRole('link', { name: `● ${renamed}`, exact: true })).toBeVisible();
    await expect(nameInput).toHaveValue(renamed);
    // 바뀐 필드가 없으면 저장 버튼이 꺼진다
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
    await shot(page, info, 'device-renamed');

    // 원래 이름으로 되돌린다
    await nameInput.fill(original);
    const reverted = writeTo(page, 'PATCH', `devices/${DEVICE_ID}`);
    await page.getByRole('button', { name: '저장', exact: true }).click();
    expect((await (await reverted).response())?.status()).toBe(200);
    await expect(tree).toBeVisible();
    await expect(page.getByRole('link', { name: `● ${renamed}`, exact: true })).toHaveCount(0);
    await expect(nameInput).toHaveValue(original);
    await shot(page, info, 'device-reverted');
  } finally {
    // 중간에 실패해도 시드 이름을 되돌린다
    const now = (await apiGet<{ items: Dev[] }>('devices?siteId=1&includeInactive=true')).items.find(
      (d) => d.deviceId === DEVICE_ID,
    );
    if (now && now.deviceName !== original)
      await apiWrite('PATCH', `devices/${DEVICE_ID}`, { deviceName: original });
  }
});
