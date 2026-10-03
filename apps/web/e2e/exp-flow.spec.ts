// EXP-FLOW — 분산 처리 모니터링(/monitoring · 관찰 보조) 한 장 화면. 직접 보내 보기는 run-flow.spec.ts가 본다.
// 설계 .omc/plans/web-junior-redesign.md §1 원칙(한 화면 = 한 장 · 쉬운 말) · §3 화면 B · §5 픽셀 예산(1440 × 900 스크롤 0) · §9 조회 줄
// 적재(Collector → 스트림 → 컨슈머)가 돌고 있어야 배치 요약이 온다 — api 컨테이너(APP_ROLE=all)가 그 구성이다.
import { expect, type Page, test } from '@playwright/test';
import { apiWrite, shot } from './support';

test.use({ viewport: { width: 1440, height: 900 } });

type Rule = { ruleId: number; threshold: number };

/** 한 장 화면 — 본문 세로 · 가로 스크롤 없음 · 서랍 · 아코디언 없음(사이드바 접기 버튼 제외) · 화면 1층에 코드 문자열 없음 */
async function expectOneGlance(page: Page) {
  const body = page.locator('[data-shell="content-body"]');
  const m = await body.evaluate((el) => ({
    sh: el.scrollHeight,
    ch: el.clientHeight,
    sw: el.scrollWidth,
    cw: el.clientWidth,
  }));
  expect(m.sh, '본문 세로 스크롤 없음').toBeLessThanOrEqual(m.ch + 1);
  expect(m.sw, '본문 가로 스크롤 없음').toBeLessThanOrEqual(m.cw + 1);
  const expanders = await page.evaluate(
    () =>
      [...document.querySelectorAll('[aria-expanded]')].filter((el) => !el.closest('[data-shell="nav"]'))
        .length + document.querySelectorAll('details').length,
  );
  expect(expanders, '서랍 · 아코디언 없음').toBe(0);
  const text = (await body.innerText()) + (await page.locator('[data-shell="content-header"]').innerText());
  expect(text).not.toMatch(/\bQ[1-5]\b|\bI2\b|EXP-|SW-|10\^/);
}

test('한 장 화면 — 실시간 연결됨 · 10초 안에 데이터 · 숫자 4 · 흐름도 노드 12(Redis 기둥 칸 5 · 조회 줄) · 카드 3 · 막대 · 각주 · 스크롤 0 · 업무 요청이 숫자와 막대에 보인다', async ({
  page,
}, info) => {
  // 이 테스트 전용 규칙(사용 해제 · 큰 임계값) — 업무 요청 하나를 보낼 대상
  const rule = (await apiWrite('POST', 'alarms/rules', {
    tagId: 1,
    conditionType: 'GT',
    threshold: 8_000_000 + Math.floor(Math.random() * 900_000),
    thresholdLow: null,
    debounceMs: 5000,
    severity: 1,
    enabled: false,
  })) as Rule;

  await page.goto('/monitoring');
  // 머리 — 실시간 연결 표지 한 알약(쉬운 말) · 화면 제목은 셸 h1 하나 + 질문형 제목(h2)
  const ws = page.getByTestId('ws-indicator');
  await expect(ws).toContainText('실시간 연결됨');
  await expect(page.locator('[data-shell="content-header"]').getByText('실시간 연결됨')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { level: 2, name: '데이터가 Redis를 거쳐 어디로 가는지 실시간으로 보기' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);

  // 10초 안에 데이터 — 마지막 데이터 나이 · 센서 데이터 초당 > 0
  await expect(ws.getByTestId('flow-sub')).toContainText('마지막 데이터', { timeout: 10_000 });
  const head = page.getByTestId('flow-headline');
  for (const label of ['센서 데이터', 'Redis에 밀린 데이터', '측정 → 저장까지', '업무 요청']) {
    await expect(head.getByText(label, { exact: true })).toBeVisible();
  }
  const num = async (key: string) => {
    const t = (await head.locator(`[data-key="${key}"] .text-2xl`).textContent()) ?? '';
    return /^[\d,.]+$/.test(t) ? Number(t.replace(/,/g, '')) : 0;
  };
  await expect
    .poll(() => num('sensor'), { timeout: 15_000, message: '센서 데이터 초당 > 0' })
    .toBeGreaterThan(0);

  // 센서 줄의 초당 숫자는 모두 같은 원천 · 같은 창(흐름 요약 최근 10초) — 숫자 4 · 공장 센서 노드 · 첫 두 간선이 한 값
  // (리드 확인 2026-10-03 — 메트릭 5초 차분과 섞여 10,004 대 8,412로 갈렸다)
  const sensorNumbers = () =>
    page.evaluate(() => {
      const t = (sel: string) => document.querySelector(sel)?.textContent ?? '';
      const node = /초당 ([\d,.]+)개/.exec(t('[data-node="src"] text:nth-of-type(2)'))?.[1] ?? null;
      const edge = (id: string) => /([\d,.]+)개\/초/.exec(t(`[data-edge="${id}"]`))?.[1] ?? null;
      return [t('[data-key="sensor"] .text-2xl'), node, edge('src-stream'), edge('stream-worker')];
    });
  await expect
    .poll(async () => new Set(await sensorNumbers()).size, {
      timeout: 15_000,
      message: '센서 숫자 넷이 한 값',
    })
    .toBe(1);

  // 흐름도 — 노드 12 = 출처 3 · Redis 기둥 칸 5 · 처리 2 · DB 2(설계 §8 — Redis는 서버와 DB 사이 한 기둥 · 오른쪽 저장 열에 Redis 노드 없음 · §9 조회 줄)
  // 쉬운 이름 · 꺼진 길은 그리지 않는다(회색 간선 없음)
  const diagram = page.getByTestId('flow-diagram');
  await expect(diagram.locator('[data-node]')).toHaveCount(12);
  await expect(diagram.locator('[data-node="redis"]')).toHaveCount(0);
  const pillar = diagram.getByTestId('redis-pillar');
  await expect(pillar).toBeVisible();
  await expect(pillar).toContainText('줄 세우고 · 지금 값을 들고 · 결과를 전해요');
  await expect(pillar).toContainText('Redis 메모리');
  for (const name of [
    '공장 센서',
    '사람의 업무 요청(api)',
    '① 센서 대기줄(Stream)',
    '② 지금 값 · 알람 상태',
    '③ 업무 대기줄(Stream)',
    '④ 옛 사본 지움 · 결과 알림',
    '사람의 조회 요청(api)',
    '⑤ 조회 사본(캐시)',
    '모아서 한 번에 저장(배치)',
    '하나씩 순서대로 처리',
    'ClickHouse',
    'PostgreSQL',
  ]) {
    await expect(diagram.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(diagram.getByText('Redis — 서버와 DB 사이 중간층', { exact: true })).toBeVisible();
  await expect(diagram.getByTestId('flow-biz-note')).toContainText(
    '업무 데이터는 ClickHouse로 보내지 않아요',
  );
  await expect(diagram.locator('[data-edge="biz-reply"]')).toContainText('결과 받음');
  await expect(diagram.locator('[data-edge][data-off]')).toHaveCount(0);
  // 조회 줄(§9.2) — 조회 요청 → ⑤ → 응답 · ⑤ ↔ ClickHouse · PostgreSQL(처리기를 거치지 않는다) · 조회가 없으면 보내 보라는 한 줄
  for (const id of ['read-ask', 'read-answer', 'read-miss', 'read-pg', 'read-ch'])
    await expect(diagram.locator(`[data-edge="${id}"]`)).toHaveCount(1);
  await expect(diagram.locator('[data-edge="read-answer"]')).toContainText('응답');
  await expect(diagram.locator('[data-edge="read-miss"]')).toContainText(
    /없으면 읽어 와 사본 담기 — ClickHouse\(센서\) .*% · PostgreSQL\(업무 목록\) .*%|조회 요청이 없어요 — 직접 보내 보기로 보내 보세요/,
    { timeout: 15_000 },
  );
  await expect(diagram.locator('[data-node="readCache"]')).toContainText('있으면 바로 응답');
  await expect(diagram).toContainText('지금까지');

  // 아래 줄 — 왜 나눌까 카드 3 · 모아서 vs 하나씩 · 각주
  const why = page.getByTestId('flow-why');
  for (const db of ['ClickHouse', 'Redis', 'PostgreSQL'])
    await expect(why.getByText(db, { exact: true })).toBeVisible();
  await expect(page.getByTestId('flow-compare')).toContainText('센서는 묶어서 많이 · 업무는 하나씩 정확히');
  await expect(page.getByTestId('flow-footnote')).toContainText('점은 보기 좋게 느리게 움직여요');
  await expect(page.getByTestId('flow-footnote')).toContainText('조회는 점 없이 숫자로만');
  for (const id of ['flow-headline', 'flow-diagram', 'flow-why', 'flow-compare', 'flow-footnote'])
    await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 });

  await expectOneGlance(page);
  await shot(page, info, 'flow-one-screen');

  // 업무 요청 — 규칙 PATCH를 api에 직접 보낸다(명령 경로 · Idempotency-Key) → 숫자 4 · 막대에 보인다
  await apiWrite('PATCH', `alarms/rules/${rule.ruleId}`, { threshold: rule.threshold + 1 });
  await expect.poll(() => num('biz'), { timeout: 15_000, message: '업무 요청 초당 > 0' }).toBeGreaterThan(0);
  await expect(page.getByTestId('flow-no-biz')).toHaveCount(0);
  await expect(page.getByTestId('flow-compare')).toContainText('업무 1건');
  await expectOneGlance(page);
  await shot(page, info, 'flow-biz-request');
});
