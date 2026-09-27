// ALM-RULES 업무 쓰기 — 규칙 등록(비활성 · 큰 임계값) → 목록 · 수정 → 즉시 반영
// 정본 docs/08_screen/05_alarm_console.md §ALM-RULES · 01_standards.md §업무 쓰기 응답 — 명령 경로
// 규칙에는 이름 칸 · 삭제 표면이 없다 — 테스트가 만든 규칙은 사용 해제 · 실행마다 다른 큰 임계값(9e6대)으로 식별된다.
import { expect, test } from '@playwright/test';
import { IDEMPOTENCY, shot } from './support';

test('규칙 등록(사용 해제) → 목록에 보인다 → 임계 수정 → 목록 · 편집 폼에 즉시 반영', async ({
  page,
}, info) => {
  const threshold = 9_000_000 + Math.floor(Math.random() * 900_000);
  const edited = threshold + 1;

  await page.goto('/alarms/rules');
  await page.getByRole('link', { name: '+ 규칙 추가' }).click();
  await expect(page).toHaveURL(/\/alarms\/rules\?new=1$/);
  await expect(page.getByText('규칙 추가', { exact: true })).toBeVisible();

  // 태그 선택기 — 사이트 → 설비 → 태그
  const picker = page.locator('label', { hasText: '태그(사이트 → 설비 → 태그)' }).locator('select');
  await picker.nth(0).selectOption({ label: '시뮬레이션 사이트' });
  await picker.nth(1).selectOption({ label: '시뮬레이션 설비 1' });
  await expect(picker.nth(2).locator('option')).not.toHaveCount(1);
  await picker.nth(2).selectOption({ index: 1 });
  await expect(page.getByText(/^tag_id \d+$/)).toBeVisible();

  await page.getByRole('combobox', { name: '조건', exact: true }).selectOption('GT');
  await page.getByRole('textbox', { name: '임계', exact: true }).fill(String(threshold));
  await page.getByRole('checkbox', { name: '사용', exact: true }).uncheck();

  const created = page.waitForRequest(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname === '/bff/alarms/rules',
  );
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const req = await created;
  expect(req.headers()[IDEMPOTENCY]).toBeTruthy();
  expect(req.postDataJSON()).toMatchObject({ conditionType: 'GT', threshold, enabled: false });
  const res = await req.response();
  if (!res) throw new Error('등록 응답 없음');
  expect(res.status()).toBe(201);
  expect(res.headers()[IDEMPOTENCY]).toBe(req.headers()[IDEMPOTENCY]);
  const { ruleId } = (await res.json()) as { ruleId: number };

  // 등록 뒤 그 규칙 편집 화면으로 · 안내 · 목록 행(GT 임계 · 해제)
  await expect(page).toHaveURL(new RegExp(`/alarms/rules/${ruleId}\\?saved=1$`));
  await expect(page.getByText(`규칙 #${ruleId} 등록 —`, { exact: false })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: new RegExp(`GT ${threshold}(?!\\d)`) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('해제');
  await expect(page.getByText(`규칙 #${ruleId} 편집`)).toBeVisible();
  await shot(page, info, 'rule-created');

  // 수정 — 임계만 바꾼다(PATCH 본문은 바뀐 필드만)
  const thr = page.getByRole('textbox', { name: '임계', exact: true });
  await expect(thr).toHaveValue(String(threshold));
  await thr.fill(String(edited));
  const patched = page.waitForRequest(
    (r) => r.method() === 'PATCH' && new URL(r.url()).pathname === `/bff/alarms/rules/${ruleId}`,
  );
  await page.getByRole('button', { name: '저장', exact: true }).click();
  const preq = await patched;
  expect(preq.postDataJSON()).toEqual({ threshold: edited });
  expect((await preq.response())?.status()).toBe(200);
  await expect(page.getByText(`규칙 #${ruleId} 저장 —`, { exact: false })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: new RegExp(`GT ${edited}(?!\\d)`) })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: new RegExp(`GT ${threshold}(?!\\d)`) })).toHaveCount(
    0,
  );
  await expect(thr).toHaveValue(String(edited));
  await shot(page, info, 'rule-edited');
});
