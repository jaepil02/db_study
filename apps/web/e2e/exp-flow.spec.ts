// EXP-FLOW — 분산 처리 모니터링(관찰 보조). 실행 패널은 이번 범위가 아니다.
// 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW — 진입이 subscribe_flow · 배치 요약 · 업무 명령 목록
// 적재(Collector → 스트림 → 컨슈머)가 돌고 있어야 배치 요약이 온다 — api 컨테이너(APP_ROLE=all)가 그 구성이다.
import { expect, test } from '@playwright/test';
import { apiWrite, shot } from './support';

type Rule = { ruleId: number; threshold: number };

test('구독 중 · 10초 안에 배치 요약 · 다른 탭의 규칙 PATCH가 업무 명령 목록에 alarm.rule.patch로 보인다', async ({
  page,
  context,
}, info) => {
  // 이 테스트 전용 규칙(사용 해제 · 큰 임계값) — 구독 전에 만들어 목록에는 PATCH만 남게 한다
  const rule = (await apiWrite('POST', 'alarms/rules', {
    tagId: 1,
    conditionType: 'GT',
    threshold: 8_000_000 + Math.floor(Math.random() * 900_000),
    thresholdLow: null,
    debounceMs: 5000,
    severity: 1,
    enabled: false,
  })) as Rule;

  await page.goto('/experiments/flow');
  const header = page.locator('[data-flow="header"]');
  await expect(header).toContainText('흐름 구독 구독 중');
  await expect(page.getByText('관찰 보조 — 기록 정본 아님').first()).toBeVisible();

  // 10초 안에 배치 요약 — 마지막 배치 시각 · 배치/초 > 0 · 타임라인 막대
  await expect(header).not.toContainText('마지막 배치 없음', { timeout: 10_000 });
  await expect
    .poll(
      async () => {
        const m = /배치 ([\d.,]+)\/초/.exec((await header.textContent()) ?? '');
        return m ? Number((m[1] as string).replace(/,/g, '')) : 0;
      },
      { timeout: 10_000, message: '배치/초 > 0' },
    )
    .toBeGreaterThan(0);
  const timeline = page
    .locator('div')
    .filter({ has: page.getByText('배치 타임라인 — 최근 20배치', { exact: false }) })
    .filter({ has: page.locator('canvas') })
    .last();
  await expect(timeline.locator('canvas').first()).toBeVisible();
  await expect(page.getByText('배치 요약이 아직 없다', { exact: false })).toHaveCount(0);
  await shot(page, info, 'flow-batches');

  // 다른 탭 — 그 탭의 JS가 규칙 PATCH를 보낸다(명령 경로 · Idempotency-Key). 규칙 쓰기는 BFF 경유가 설계 경로다 —
  // api CORS는 직결 표면(GET · POST)에만 열려 있어 브라우저가 api에 PATCH를 직접 보내면 preflight에서 막힌다(07_api/01 · 12_security/03)
  const other = await context.newPage();
  await other.goto('/alarms/rules');
  const status = await other.evaluate(
    async ({ ruleId, threshold }) => {
      const res = await fetch(`/bff/alarms/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ threshold: threshold + 1 }),
      });
      return res.status;
    },
    { ruleId: rule.ruleId, threshold: rule.threshold },
  );
  expect(status).toBe(200);
  await other.close();

  // 업무 명령 목록 — alarm.rule.patch · ok · 발행 주체 biz-writer
  const bizRow = page.getByRole('row').filter({ hasText: 'alarm.rule.patch' }).first();
  await expect(bizRow).toBeVisible({ timeout: 10_000 });
  await expect(bizRow).toContainText('ok');
  await expect(bizRow).toContainText('biz-writer');
  // 시각 칸 — KST(밀리초) · DB UTC 저장 전환 뒤에도 표시는 KST 벽시계여야 한다(지금과 1분 안)
  const at = ((await bizRow.getByRole('cell').first().textContent()) ?? '').trim();
  expect(at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} KST$/);
  const atMs = Date.parse(`${at.replace(' KST', '').replace(' ', 'T')}+09:00`);
  expect(Math.abs(atMs - Date.now())).toBeLessThan(60_000);
  await bizRow.scrollIntoViewIfNeeded();
  await shot(page, info, 'flow-biz-patch');
});
