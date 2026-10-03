// EXP-PERF — 성능 비교 한 장 화면(1440 × 900 · 스크롤 · 서랍 · 탭 없음) · 두 구역(센서 데이터 · 업무 데이터) · 그림 1 → 그림 2 · 한 줄 정리
// 설계 .omc/plans/web-junior-redesign.md §1 원칙 · §2 화면 A · §4 용어표 · §5 픽셀 예산 · 다듬기 .omc/plans/web-ux-polish.md §2 · §3 · 정본 docs/08_screen/08_evidence_screens.md §EXP-PERF
import { expect, type Locator, type Page, test } from '@playwright/test';
import { shot } from './support';

test.use({ viewport: { width: 1440, height: 900 } });

/** 본문 스크롤 요소 — 셸 main(data-shell="content-body") */
const body = (page: Page) => page.locator('[data-shell="content-body"]');

/** 본문에 세로 · 가로 스크롤이 없다(scrollHeight ≤ clientHeight + 1) */
async function expectNoScroll(page: Page) {
  const m = await body(page).evaluate((el) => ({
    sh: el.scrollHeight,
    ch: el.clientHeight,
    sw: el.scrollWidth,
    cw: el.clientWidth,
  }));
  expect(m.sh, `본문 세로 스크롤 ${m.sh} > ${m.ch}`).toBeLessThanOrEqual(m.ch + 1);
  expect(m.sw, `본문 가로 스크롤 ${m.sw} > ${m.cw}`).toBeLessThanOrEqual(m.cw + 1);
}

/**
 * 두 구역 글자 크기 표본 — 업무 질문 · 업무 답 숫자 · 그림 1 질문 이름(px). 넓고 높은 화면(가로 ≥ 1680 · 세로 ≥ 1000)에서만 한 단계 크다(§9 P1 · perf/roomy.ts):
 * 1440 × 900 · 1280 × 800은 14 · 16 · 14 · 1920 × 1080은 16 · 20 · 16.
 */
async function sampleSizes(page: Page) {
  const biz = page.getByRole('region', { name: '업무 데이터' });
  const size = async (l: Locator) =>
    Number.parseFloat(await l.evaluate((el) => getComputedStyle(el).fontSize));
  return {
    question: await size(biz.getByTestId('situation-card').first().locator('h3')),
    answer: await size(biz.locator('[data-ok="true"] .font-bold').first()),
    fig1: await size(page.getByTestId('speed-row').first().locator('span.truncate')),
  };
}

/** 서랍 · 아코디언 없음 — aria-expanded 요소 0(사이드바 접기 · 펼치기 버튼 제외) */
async function expectNoDrawer(page: Page) {
  await expect(page.locator('[aria-expanded]:not([aria-controls="shell-nav"])')).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(0);
}

/**
 * 화면 안 글자 최소 12px — 본문 안 보이는 글자가 있는 모든 요소의 실제 크기(HTML은 계산된 font-size · SVG text는 font-size × 화면 배율).
 * 캔버스(그림 2)는 단위 시험(type-floor)이 옵션 값으로 본다. sr-only(1px 상자)는 화면에 보이지 않아 뺀다.
 */
async function expectTypeFloor(page: Page) {
  const small = await body(page).evaluate((root) => {
    const out: string[] = [];
    for (const el of root.querySelectorAll<HTMLElement | SVGElement>('*')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
      if (!own || el.closest('.sr-only')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      let px = Number.parseFloat(getComputedStyle(el).fontSize);
      if (el instanceof SVGTextElement) px *= el.getScreenCTM()?.a ?? 1;
      if (px < 11.95) out.push(`${px.toFixed(1)}px ${(el.textContent ?? '').trim().slice(0, 24)}`);
    }
    return out;
  });
  expect(small, '12px 미만 글자').toEqual([]);
}

/** 화면 1층에 내부 코드 · 지수 표기 없음 — 보이는 글자(innerText)만 본다(툴팁 title은 제외) */
async function expectNoCodes(page: Page) {
  const text = await body(page).innerText();
  expect(text).not.toMatch(/\b(Q[1-5]|I[12])\b/);
  expect(text).not.toContain('EXP-');
  expect(text).not.toContain('SW-');
  expect(text).not.toContain('10^');
}

test('진입 — 제목 · 두 구역 · 그림 1(5행 · 선택 Q2) · 그림 2(캔버스 · 역전 문장) · 왜? 두 줄 · 상황 네 줄 · 한 줄 정리 · 스크롤 · 서랍 · 코드 없음 · 글자 12px 이상 · Pretendard', async ({
  page,
}, info) => {
  await page.goto('/performance');
  await expect(page).toHaveURL(/\/performance\?q=Q2$/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'PostgreSQL과 ClickHouse, 어떤 데이터에 무엇이 맞을까?' }),
  ).toBeVisible();

  const sensor = page.getByRole('region', { name: '센서 데이터' });
  const biz = page.getByRole('region', { name: '업무 데이터' });
  await expect(sensor).toContainText('데이터가 많아질수록 ClickHouse가 훨씬 빨라요');
  await expect(biz).toContainText('정확해야 하는 업무 데이터는 PostgreSQL이 맞아요');

  // 그림 1 — 질문 5행 · 막대 끝 배수 · 기본 선택 "센서 1개 · 7일"
  const fig1 = page.getByRole('region', { name: '그림 1' });
  await expect(fig1.getByTestId('speed-row')).toHaveCount(5);
  await expect(fig1.getByTestId('speed-row').filter({ hasText: '센서 1개 · 7일' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(fig1).toContainText(/CH \d+(\.\d)?배/);
  await expect(fig1).toContainText(/PG \d+(\.\d)?배/);
  // 막대 기준 폭이 줄마다 같다 — 막대가 놓인 반쪽의 라벨 칸을 뺀 폭이 다섯 줄 모두 같고 막대 % = 로그 비(§7.1 R2)
  const tracks = await fig1.getByTestId('speed-fill').evaluateAll((els) =>
    els.map((el) => {
      const half = el.parentElement as HTMLElement;
      const cs = getComputedStyle(half);
      return half.clientWidth - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight);
    }),
  );
  expect(tracks.length).toBeGreaterThanOrEqual(4);
  // 허용 1px — 가운데 축 선이 PG 쪽 반쪽의 border-r(1px)라 PG 막대 기준 폭만 1px 좁다(약 180px 중 0.5% · 눈에 보이지 않음)
  expect(Math.max(...tracks) - Math.min(...tracks)).toBeLessThanOrEqual(1);
  // 줄 전체가 버튼 — 손가락 커서 · 안내 한 줄
  await expect(fig1.getByTestId('speed-row').first()).toHaveCSS('cursor', 'pointer');
  await expect(fig1).toContainText('줄을 누르면 아래 그림이 그 질문으로 바뀌어요');

  // 그림 2 — 캔버스가 실제로 그려진다 · 역전 문장
  const fig2 = page.getByRole('region', { name: '그림 2' });
  await expect(fig2).toContainText('센서 1개 · 7일 — 데이터가 많아질수록 걸리는 시간');
  await expect(fig2.getByTestId('cross-sentence')).toContainText('역전');
  const canvas = fig2.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(300);
  expect(box?.height ?? 0).toBeGreaterThan(120);

  // 왜? 두 줄(작은 그림 + 쉬운 문장 · "몫"은 툴팁에만) · 상황 네 줄(지킴 · 못 지킴 표시 · 이긴 쪽 알약)
  const why = page.getByRole('region', { name: '왜 그런가' });
  await expect(why).toContainText('필요한 칸만 읽어요');
  await expect(why).toContainText('같은 값끼리 모아 줄여요');
  await expect(why).toContainText(/전체 중 읽는 비율이 PG가 \d+(\.\d)?배 높아요/);
  expect(await why.innerText()).not.toContain('몫');
  await expect(biz.getByTestId('situation-card')).toHaveCount(4);
  await expect(biz.locator('[data-ok="true"]')).toHaveCount(2);
  await expect(biz.locator('[data-ok="false"]')).toHaveCount(2);
  await expect(biz.getByTestId('situation-winner')).toHaveCount(4);
  await expect(biz.getByTestId('situation-winner').first()).toContainText('PostgreSQL');
  await expect(biz).toContainText(/\d+(\.\d)?배 이상 느림/);

  // 한 줄 정리(두 조각 알약) · 각주(툴팁에 기록 번호)
  await expect(page.getByTestId('perf-summary')).toContainText('한 줄 정리');
  await expect(page.getByTestId('perf-summary')).toContainText(
    '많이 쌓아 두고 크게 훑는 데이터 → ClickHouse',
  );
  await expect(page.getByTestId('perf-summary')).toContainText('정확하게 한 건씩 다루는 데이터 → PostgreSQL');
  await expect(page.getByTestId('perf-footnote')).toContainText(
    '같은 일을 3번씩 시킨 중간값 · 걸린 시간은 참고용 · 누가 이기는지는 3번 모두 같을 때만',
  );
  await expect(page.getByTestId('perf-footnote-tip')).toHaveAttribute('title', /원천 기록 \d{3}/);

  // 한 장 — 1440 × 900에서 본문 스크롤 없음 · 모든 구역이 화면 안 · 서랍 · 탭 없음 · 코드 문자열 없음
  await expectNoScroll(page);
  for (const r of [sensor, biz, page.getByTestId('perf-footnote')]) {
    const b = await r.boundingBox();
    expect((b?.y ?? 0) + (b?.height ?? 0)).toBeLessThanOrEqual(900);
  }
  await expectNoDrawer(page);
  await expectNoCodes(page);
  await expectTypeFloor(page);
  // 1440 × 900은 넓고 높은 화면 변형이 꺼져 있다 — 글자 크기 그대로(§9 P1)
  expect(await sampleSizes(page)).toEqual({ question: 14, answer: 16, fig1: 14 });
  // 글꼴 — Pretendard Variable(자체 호스팅 · next/font/local)이 실제로 실렸다
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      family: getComputedStyle(document.body).fontFamily,
      loaded: document.fonts.check('16px pretendard'),
    };
  });
  expect(font.family).toMatch(/pretendard/i);
  expect(font.loaded).toBe(true);
  await shot(page, info, 'perf-one-glance');
});

test('1920 × 1080 — 본문 최대 폭 88rem(1408px) 가운데 · 스크롤 없음 · 두 구역 글자 한 단계 크게 · 업무 줄 사이 64px 이하 · 업무 구역 아래 빈 높이 200px 이하 / 1280 × 800 — 가로 스크롤 없음 · 구역과 한 줄 정리가 겹치지 않는다 · 글자 그대로', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/performance');
  const sensor = page.getByRole('region', { name: '센서 데이터' });
  await expect(sensor).toContainText('데이터가 많아질수록 ClickHouse가 훨씬 빨라요');
  await expectNoScroll(page);
  const biz = page.getByRole('region', { name: '업무 데이터' });
  const [s, b] = [await sensor.boundingBox(), await biz.boundingBox()];
  const width = (b?.x ?? 0) + (b?.width ?? 0) - (s?.x ?? 0);
  expect(width).toBeLessThanOrEqual(1408 + 1);
  expect(width).toBeGreaterThan(1300);
  // 넓고 높은 화면(가로 ≥ 1680 · 세로 ≥ 1000) — 두 구역 글자 한 단계 크게(질문 14 → 16 · 답 숫자 16 → 20 · 그림 1 질문 이름 14 → 16 · §9 P1)
  expect(await sampleSizes(page)).toEqual({ question: 16, answer: 20, fig1: 16 });
  // 업무 네 줄 — 줄 사이(위 줄 끝 ~ 아래 줄 시작) 64px 이하(틈 칸 최대 48 + 줄 위아래 여백 8 + 8) · 남는 높이는 구역 아래(§7.1 R11a · L4 · §9 P1)
  await expect(biz.getByTestId('situation-card')).toHaveCount(4);
  const cards = await biz.getByTestId('situation-card').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      // 줄의 글자 영역 — 위아래 여백(py)을 뺀다
      return {
        top: r.top + Number.parseFloat(cs.paddingTop),
        bottom: r.bottom - Number.parseFloat(cs.paddingBottom),
      };
    }),
  );
  for (let i = 1; i < cards.length; i++) {
    const gap = (cards[i]?.top ?? 0) - (cards[i - 1]?.bottom ?? 0);
    expect(gap, `업무 ${i}번째 줄 사이 ${gap.toFixed(1)}px`).toBeLessThanOrEqual(64.5);
  }
  // 업무 구역 아래 빈 높이(마지막 줄 글자 끝 ~ 구역 안쪽 바닥) 200px 이하 — 휑하지 않게(§9 P1).
  // 계산: 본문 984(1080 − 머리 56 − 여백 40) − 제목 28 − 한 줄 정리 26 − 틈 12 × 2 = 구역 906 ·
  // 구역 안 = 테두리 2 + 머리 띠 65 + 줄 4 × 142 + 틈 칸 3 × 48 = 779 → 빈 127 + 마지막 줄 아래 여백 8 = 135(진행 띠가 있으면 더 작다 · 근거 perf/roomy.ts)
  const empty = await biz.evaluate((el) => {
    const last = [...el.querySelectorAll('[data-testid="situation-card"]')].at(-1) as HTMLElement;
    const pb = Number.parseFloat(getComputedStyle(last).paddingBottom);
    const bb = Number.parseFloat(getComputedStyle(el).borderBottomWidth);
    return el.getBoundingClientRect().bottom - bb - (last.getBoundingClientRect().bottom - pb);
  });
  expect(empty, `업무 구역 아래 빈 높이 ${empty.toFixed(1)}px`).toBeLessThanOrEqual(200);
  await shot(page, info, 'perf-1920');

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/performance');
  await expect(sensor).toContainText('데이터가 많아질수록 ClickHouse가 훨씬 빨라요');
  const m = await body(page).evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  expect(m.sw).toBeLessThanOrEqual(m.cw + 1);
  const footer = await page.getByTestId('perf-summary').boundingBox();
  for (const r of [sensor, biz]) {
    const box = await r.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((footer?.y ?? 0) + 1);
  }
  await expectTypeFloor(page);
  // 1280 × 800은 변형 꺼짐 — 글자 그대로
  expect(await sampleSizes(page)).toEqual({ question: 14, answer: 16, fig1: 14 });
  await shot(page, info, 'perf-1280');
});

test('그림 1 행을 누르면 그림 2 · 왜? ①이 그 질문으로 · 주소 q가 따라간다 · 딥링크로 열린다', async ({
  page,
}, info) => {
  await page.goto('/performance');
  const fig2 = page.getByRole('region', { name: '그림 2' });
  const row = page.getByTestId('speed-row').filter({ hasText: '설비 1대 · 하루' });
  await row.click();
  await expect(row).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\?q=Q3$/);
  await expect(fig2).toContainText('설비 1대 · 하루 — 데이터가 많아질수록 걸리는 시간');
  await expectNoScroll(page);
  await shot(page, info, 'perf-q3');

  // 딥링크 — 벗어난 값은 Q2
  await page.goto('/performance?q=Q5');
  await expect(page.getByTestId('speed-row').filter({ hasText: '전체 데이터 훑기' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(fig2).toContainText('전체 데이터 훑기');
  await page.goto('/performance?q=Q9');
  await expect(page).toHaveURL(/\?q=Q2$/);
});

test('/ 는 /performance로 보낸다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/performance/);
});
