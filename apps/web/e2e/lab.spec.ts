// ⑤ 직접 비교 실험(/lab) — 렌더 · 부분별 최근 결과 3(넣기 · 조회 대결 · 데이터 정합성) · 반응형(맞춤 보기 4크기 스크롤 0 · 작은 화면 가로 0)
// 정본 docs/08_screen/10_lab_screen.md §EXP-LAB · 계약 packages/shared/src/api/runs.ts(CompareLatestBody)
// 결과 숫자는 api가 보관한 마지막 결과(GET /api/v1/runs/latest?type=compare)와 같은지만 본다 — 실행은 누르지 않는다(데이터 · 실행 상태를 바꾸지 않는다).
// 업무 방해(interfere)는 D-16 뒤 사용자 결정으로 삭제 — 패널 · 문구가 없어야 한다.
// 실시간(사용자 결정 2026-10-11) — 실제 compare 실행은 시작하지 않는다(넣기는 시작하자마자 발표용 데이터 구간을 비운다) ·
// 대신 /bff/runs/current · /bff/runs/latest 응답을 page.route로 차례로 바꿔 재는 중 패널이 1초 폴링마다 채워지는지 본다.
import { expect, type Page, type Route, test } from '@playwright/test';
import {
  apiGet,
  expectFits,
  expectNoSideScroll,
  FIT_VIEWPORTS,
  SMALL_VIEWPORT,
  settleRuns,
  shot,
  waitForScreen,
} from './support';

const PARTS = ['ingest', 'query', 'consistency'] as const;
type Part = (typeof PARTS)[number];

type Entry = {
  status: 'completed' | 'stopped' | 'failed';
  result:
    | { part: 'ingest'; rows: { published: number; clickhouse: number; postgres: number } }
    | {
        part: 'query';
        sizes: {
          target: number;
          cut: unknown;
          winner: 'clickhouse' | 'postgres' | null;
          ratio: number | null;
          match: boolean | null;
          clickhouse: { sourceRows: number | null };
          postgres: { sourceRows: number | null };
        }[];
      }
    | { part: 'consistency'; match: boolean | null }
    | null;
};
type Attempt = { status: 'completed' | 'stopped' | 'failed'; endedAt: string };
type Latest = Record<Part, (Entry & { endedAt: string }) | null> & {
  attempts?: Record<Part, Attempt | null>;
};

/** api 보관 결과 한 부분 → 패널 data-state(lab-model partState와 같은 규칙 — 결과는 부분별 최근 완료 1건) */
const expectedState = (e: Entry | null, part: Part): string =>
  e && e.status === 'completed' && e.result?.part === part ? 'ok' : 'none';

/** 그 완료 결과보다 뒤에 끝난 중단 · 실패 시도 → 패널 data-attempt(없으면 빈 값) */
const expectedAttempt = (l: Latest, part: Part): string => {
  const e = l[part];
  const a = l.attempts?.[part] ?? (e && e.status !== 'completed' ? e : null);
  const done = e?.status === 'completed' ? e : null;
  if (!a || a.status === 'completed') return '';
  return !done || Date.parse(a.endedAt) > Date.parse(done.endedAt) ? a.status : '';
};

/** 세 패널이 읽기를 마칠 때까지(읽는 중이 아닐 때까지) */
async function panelsSettled(page: Page) {
  for (const part of PARTS)
    await expect(page.getByTestId(`lab-panel-${part}`)).not.toHaveAttribute('data-state', 'loading', {
      timeout: 15_000,
    });
}

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => settleRuns());

test('⑤ 렌더 — 질문형 제목 · 머리(쌓인 비교 데이터 · 데이터 지우기) · 패널 3(업무 방해 없음) · 부분별 최근 결과가 api 보관값 그대로', async ({
  page,
}, info) => {
  const latest = await apiGet<Latest>('runs/latest?type=compare');
  await page.goto('/lab');
  await waitForScreen(page, 'lab');
  await expect(
    page.getByRole('heading', { level: 2, name: '같은 센서 데이터를 Redis로 두 DB에 넣어 보면?' }),
  ).toBeVisible();
  await expect(page.getByTestId('lab-stats')).toContainText('쌓인 비교 데이터');
  await expect(page.getByTestId('lab-stats')).not.toContainText('못 읽었어요');
  await expect(page.getByTestId('purge')).toBeVisible();

  // 패널 3 — 넣기 · 조회 대결 · 데이터 정합성(업무 방해 · 무결성 규칙 시험은 삭제)
  await expect(page.locator('[data-testid^="lab-panel-"]')).toHaveCount(3);
  await expect(page.getByTestId('lab-panel-interfere')).toHaveCount(0);
  await expect(page.locator('[data-screen="lab"]')).not.toContainText('업무 방해');
  await panelsSettled(page);
  for (const part of PARTS) {
    await expect(page.getByTestId(`lab-panel-${part}`)).toHaveAttribute(
      'data-state',
      expectedState(latest[part], part),
    );
    // 마지막 시도가 중단 · 실패면 "마지막 시도는 …" 한 줄(그 전 완료 결과는 그대로)
    const tried = expectedAttempt(latest, part);
    await expect(page.getByTestId(`lab-panel-${part}`)).toHaveAttribute('data-attempt', tried);
    if (tried)
      await expect(page.getByTestId('lab-attempt').filter({ hasText: '마지막 시도는' })).not.toHaveCount(0);
    await expect(page.getByTestId(`lab-run-${part}`)).toBeVisible();
  }

  // ① 넣기 — 행 수 대조(보낸 = CH = PG) · 디스크 막대 · 결론 한 줄
  const ingest = latest.ingest?.result;
  if (ingest?.part === 'ingest') {
    const same =
      ingest.rows.clickhouse === ingest.rows.postgres && ingest.rows.postgres === ingest.rows.published;
    await expect(page.getByTestId('ingest-same')).toHaveAttribute('data-same', String(same));
    await expect(page.getByTestId('ingest-disk')).toContainText('디스크 크기');
    await expect(page.getByTestId('ingest-sentence')).toContainText(
      same ? '두 DB에 똑같이 들어갔어요' : '두 DB의 행 수가 달라요',
    );
  } else await expect(page.getByTestId('lab-panel-ingest').getByTestId('lab-empty')).toBeVisible();

  // ② 조회 대결 — 원천 행 수 9단계 꺾은선 · 잰 단계 수는 api 보관값 그대로 ·
  // 데이터 비교 줄(원천 행 수 · 칸 대조)은 없다 — ③ 데이터 정합성 몫(사용자 지시 2026-10-12)
  const query = latest.query?.result;
  if (query?.part === 'query') {
    const chart = page.getByTestId('query-chart');
    await expect(chart).toBeVisible();
    await expect(chart.locator('canvas').first()).toBeVisible();
    const measured = query.sizes.filter((x) => x.cut !== null);
    await expect(chart).toHaveAttribute('data-points', String(measured.length));
    await expect(page.getByTestId('query-check')).toHaveCount(0);
  } else await expect(page.getByTestId('lab-panel-query').getByTestId('lab-empty')).toBeVisible();

  // ③ 데이터 정합성 — 기준 4줄(행 수 · 값 합계 · 묶음 집계 · 행 지문) · 일치 여부 api 값 그대로
  const consistency = latest.consistency?.result;
  if (consistency?.part === 'consistency') {
    await expect(page.getByTestId('consistency-row')).toHaveCount(4);
    await expect(page.getByTestId('consistency')).toHaveAttribute('data-match', String(consistency.match));
  } else await expect(page.getByTestId('lab-panel-consistency').getByTestId('lab-empty')).toBeVisible();

  await expect(page.getByTestId('lab-foot')).toContainText('승패는 3번 모두 같을 때만');
  await shot(page, info, 'lab');
});

for (const vp of FIT_VIEWPORTS)
  test(`반응형 ${vp.width}×${vp.height} — 패널 3이 한 장에 · 페이지 스크롤 0 · 가로 넘침 0 · 잘린 상자 0`, async ({
    page,
  }, info) => {
    await page.setViewportSize(vp);
    await page.goto('/lab');
    await waitForScreen(page, 'lab');
    await panelsSettled(page);
    await expectFits(page, `lab ${vp.width}×${vp.height}`);
    for (const part of PARTS)
      await expect(page.getByTestId(`lab-panel-${part}`)).toBeInViewport({ ratio: 1 });
    await expect(page.getByTestId('lab-foot')).toBeInViewport({ ratio: 1 });
    await shot(page, info, `lab-${vp.width}x${vp.height}`);
  });

test(`작은 화면 ${SMALL_VIEWPORT.width}×${SMALL_VIEWPORT.height} — 한 줄로 쌓고 세로만 스크롤 · 가로 스크롤 0`, async ({
  page,
}, info) => {
  await page.setViewportSize(SMALL_VIEWPORT);
  await page.goto('/lab');
  await waitForScreen(page, 'lab');
  await panelsSettled(page);
  await expectNoSideScroll(page, 'lab 작은 화면');
  await shot(page, info, 'lab-small');
});

// ── 실시간 — 재는 중인 패널만 지난 결과를 지우고 중간 결과로 새로 그린다 ──
// 숫자는 화면 동작을 보려는 목 값이다(보관 결과 모양은 계약 packages/shared/src/api/runs.ts 그대로 — 화면이 zod로 검사한다).

const OLD_ID = '00000000-0000-4000-8000-000000000001';
const NEW_ID = '00000000-0000-4000-8000-0000000000aa';
const T0 = '2026-10-11T10:00:00.000Z';

const rep = (median: number, target: number) => ({
  values: [median, median, median],
  median,
  sourceRows: target,
  groups: 129,
  checksum: '1',
});
/** 원천 행 수 한 단계 — 중간값은 2026-10-12 실측을 반올림한 목 값 */
const sized = (target: number, pg: number, ch: number) => ({
  target,
  cut: { ts: '2026-10-08T00:00:43.000Z', deviceId: 16, tagId: 67 },
  postgres: rep(pg, target),
  clickhouse: rep(ch, target),
  winner: pg < ch ? 'postgres' : 'clickhouse',
  ratio: Math.max(pg, ch) / Math.min(pg, ch),
  match: true,
  mismatchGroups: 0,
});
/** 넣기 건수와 같은 9단계(10만 ~ 10억) */
const SIZES = [
  sized(100_000, 4.8, 15.2),
  sized(1_000_000, 92, 19.6),
  sized(5_000_000, 245, 54.4),
  sized(10_000_000, 366, 95.2),
  sized(30_000_000, 697, 263),
  sized(50_000_000, 1060, 436),
  sized(100_000_000, 2130, 880),
  sized(500_000_000, 10_700, 4_400),
  sized(1_000_000_000, 21_400, 8_800),
];
/** ③ 데이터 정합성 결과 — 사흘 · PostgreSQL이 묶음 하나(49,994행)를 잃은 경우 */
const CONSISTENCY_CH = {
  rows: 59_875_200,
  sum: '1234567890123456',
  groups: 9_288,
  fingerprint: '-4823749823749823749',
  scanMs: 412,
};
const CONSISTENCY = {
  part: 'consistency',
  rangeStart: '2026-10-08T00:00:00.000Z',
  rangeEnd: '2026-10-11T00:00:00.000Z',
  clickhouse: CONSISTENCY_CH,
  postgres: {
    rows: 59_825_206,
    sum: '1234560123456789',
    groups: 9_288,
    fingerprint: '7234987234987234',
    scanMs: 2_380,
  },
  checks: { rows: false, sum: false, groups: false, fingerprint: false },
  mismatchGroups: 129,
  diffGroups: 129,
  mismatches: [
    {
      deviceId: 1,
      tagId: 2,
      label: 'L1-PRT 인쇄 · 잉크 온도',
      hour: '2026-10-08T17:00:00.000Z',
      clickhouse: 3_600,
      postgres: 2_820,
    },
  ],
  match: false,
};
/** 재는 중 — 구간만(두 저장소 모두 아직) */
const CONSISTENCY_START = {
  ...CONSISTENCY,
  clickhouse: null,
  postgres: null,
  checks: null,
  mismatchGroups: null,
  diffGroups: null,
  mismatches: [],
  match: null,
};

/** 넣기 결과 — n초째(timeline 점 n개 · 보낸 행 = n × 10만) · 두 DB는 조금 뒤처진다(넣는 중엔 서로 다른 게 정상) */
function ingestResult(n: number, opts: { final?: boolean; target?: number } = {}) {
  const sent = opts.final ? 829_440 : n * 100_000;
  return {
    part: 'ingest',
    target: opts.target ?? 1_000_000,
    inflightCompress: false,
    rangeStart: '2026-10-07T14:00:00.000Z',
    rangeEnd: '2026-10-07T15:00:00.000Z',
    rows: {
      published: sent,
      clickhouse: opts.final ? sent : Math.max(0, sent - 20_000),
      postgres: opts.final ? sent : Math.max(0, sent - 30_000),
    },
    elapsedMs: n * 1000,
    rowsPerSec: n > 0 ? Math.round((sent - 30_000) / n) : 0,
    batches: {
      count: n * 4,
      clickhouseMs: { p50: 90 + n, p95: 120 + n },
      postgresMs: { p50: 200 + n, p95: 240 + n },
      postgresFailures: 0,
    },
    bytes:
      n >= 3 ? { clickhouse: n * 2_000_000, postgres: n * 90_000_000 } : { clickhouse: null, postgres: null },
    timeline: Array.from({ length: n }, (_, i) => ({
      tSec: i + 1,
      clickhouseMs: 90 + ((i * 7) % 30),
      postgresMs: 200 + ((i * 11) % 40),
      rows: (i + 1) * 100_000,
    })),
  };
}

const latestEntry = (runId: string, part: Part, result: unknown, endedAt: string) => ({
  runId,
  status: 'completed',
  params: { part, rows: part === 'ingest' ? 50_000_000 : 1_000_000 },
  result,
  startedAt: T0,
  endedAt,
  commitHash: null,
  switches: { 'SW-09': 'gated' },
  plantOn: false,
});

/** 보관 결과 — 지난 완료 셋(넣기는 하루치 1,996만 행 — 새 넣기(83만 행)와 글자가 갈린다) */
const OLD_LATEST = {
  ingest: latestEntry(
    OLD_ID,
    'ingest',
    {
      ...ingestResult(2, { final: true, target: 19_958_400 }),
      rows: { published: 19_958_400, clickhouse: 19_958_400, postgres: 19_958_400 },
      bytes: { clickhouse: 52_470_028, postgres: 2_334_433_280 },
    },
    '2026-10-11T09:00:00.000Z',
  ),
  query: latestEntry(
    OLD_ID,
    'query',
    {
      part: 'query',
      rows: 1_000_000_000,
      rangeStart: '2026-08-21T00:00:00.000Z',
      rangeEnd: '2026-10-10T02:30:05.000Z',
      sizes: SIZES,
    },
    '2026-10-11T09:00:00.000Z',
  ),
  consistency: latestEntry(OLD_ID, 'consistency', CONSISTENCY, '2026-10-11T09:00:00.000Z'),
  attempts: { ingest: null, query: null, consistency: null },
};

type Step = { key: string; status: 'pending' | 'running' | 'done'; detail?: Record<string, unknown> };
const run = (
  part: Part,
  status: 'running' | 'completed',
  steps: Step[],
  result: unknown,
  elapsedSec: number,
) => ({
  runId: NEW_ID,
  type: 'compare',
  status,
  params: { part, rows: 1_000_000 },
  startedAt: T0,
  endedAt: status === 'completed' ? '2026-10-11T10:01:00.000Z' : null,
  elapsedMs: elapsedSec * 1000,
  steps: steps.map((st) => ({
    key: st.key,
    label: st.key,
    status: st.status,
    startedAt: null,
    endedAt: null,
    elapsedMs: null,
    detail: st.detail ?? {},
  })),
  result,
  error: null,
});

/** 단계 목록 — keys 중 앞 done개는 끝남 · 다음 하나는 진행 중 · 나머지는 대기(running 없이 모두 끝나면 done = keys.length) */
const stepsAt = (
  keys: string[],
  done: number,
  detail: Record<string, Record<string, unknown>> = {},
): Step[] =>
  keys.map((key, i) => ({
    key,
    status: i < done ? 'done' : i === done ? 'running' : 'pending',
    detail: detail[key],
  }));

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * 목 서버 — 현재 실행(current)은 지금 값을 그대로 · 보관 결과(latest)는 완료 뒤 새 결과로 바꾸되 늦게(1.5초) 돌려준다
 * (끝난 순간부터 다시 읽기 전까지 화면이 실행의 최종 결과를 보이는지 — 지난 결과로 되돌아가는 깜빡임이 없는지 보려고)
 */
async function mockRuns(page: Page, part: Part) {
  const state = { current: null as unknown, latest: OLD_LATEST as unknown, latestDelayMs: 0 };
  await page.route(
    (u) => u.pathname === '/bff/runs/current',
    (route) => json(route, { run: state.current }),
  );
  await page.route(
    (u) => u.pathname === '/bff/runs/latest',
    async (route) => {
      const body = state.latest;
      if (state.latestDelayMs) await new Promise((r) => setTimeout(r, state.latestDelayMs));
      await json(route, body);
    },
  );
  /** 완료 — current를 완료 객체로 · latest는 그 실행을 보관한 결과로(늦게) */
  const complete = (result: unknown, steps: Step[], elapsedSec: number) => {
    state.latestDelayMs = 1_500;
    state.latest = { ...OLD_LATEST, [part]: latestEntry(NEW_ID, part, result, '2026-10-11T10:01:00.000Z') };
    state.current = run(part, 'completed', steps, result, elapsedSec);
  };
  return { state, complete };
}

/** 지난 결과 글자가 패널에 한 번이라도 다시 나타나면 센다(MutationObserver) — 시작한 뒤 지난 결과를 흐리게도 겹치지 않는다 */
async function watchForText(page: Page, testId: string, text: string) {
  await page.evaluate(
    ({ testId, text }) => {
      const el = document.querySelector(`[data-testid="${testId}"]`);
      const w = window as unknown as { __seen: number };
      w.__seen = 0;
      if (!el) throw new Error(`${testId} 없음`);
      const check = () => {
        if (el.textContent?.includes(text)) w.__seen += 1;
      };
      check();
      new MutationObserver(check).observe(el, { subtree: true, childList: true, characterData: true });
    },
    { testId, text },
  );
}
const seenCount = (page: Page) => page.evaluate(() => (window as unknown as { __seen: number }).__seen);

/** 재는 중 반응형 — 맞춤 보기 4크기 스크롤 0 · 잘린 상자 0 · 작은 화면 가로 0 */
async function expectLiveFits(page: Page, label: string) {
  for (const vp of FIT_VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(400); // 차트 크기 관찰 · 다시 그리기
    await expectFits(page, `${label} ${vp.width}×${vp.height}`);
    for (const p of PARTS) await expect(page.getByTestId(`lab-panel-${p}`)).toBeInViewport({ ratio: 1 });
  }
  await page.setViewportSize(SMALL_VIEWPORT);
  await page.waitForTimeout(400);
  await expectNoSideScroll(page, `${label} 작은 화면`);
  await page.setViewportSize({ width: 1600, height: 900 });
}

const INGEST_STEPS = ['prepare', 'clear', 'publish', 'drain', 'verify'];

test('실시간 ① 넣기 — 지난 결과를 지우고 선 그림 · 보낸 행 · 디스크 막대가 1초마다 자란다 · 끝나기 전 ✓ · ✕ 없음 · 끝나도 깜빡임 없음', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const mock = await mockRuns(page, 'ingest');
  // 비우는 중 — 결과 null
  mock.state.current = run('ingest', 'running', stepsAt(INGEST_STEPS, 1), null, 1);
  await page.goto('/lab');
  await waitForScreen(page, 'lab');
  const panel = page.getByTestId('lab-panel-ingest');
  const chart = panel.getByTestId('ingest-chart');
  await expect(panel).toHaveAttribute('data-state', 'live');
  await watchForText(page, 'lab-panel-ingest', '1,996만');
  // 지난 결과(✓ · 1,996만 행)는 보이지 않고 빈 축 + 지금 단계 한 줄
  await expect(panel.getByTestId('ingest-same')).toHaveCount(0);
  await expect(chart).toHaveAttribute('data-points', '0');
  await expect(panel.getByTestId('ingest-chart-step')).toHaveText('지난 구간 비우는 중이에요');
  await expect(panel.getByTestId('ingest-live-sent')).toContainText('—');
  await expect(page.getByTestId('lab-live-now')).toHaveText('지금 재는 중');
  // 그림 캔버스에 표시를 단다 — 끝날 때까지 같은 캔버스면 차트를 다시 만들지 않은 것(빈 캔버스로 깜빡이지 않음)
  await chart
    .locator('canvas')
    .first()
    .evaluate((el) => {
      (el as unknown as { __keep: boolean }).__keep = true;
    });
  // 다른 두 패널은 보관 결과 그대로
  await expect(page.getByTestId('lab-panel-query')).toHaveAttribute('data-state', 'ok');
  await expect(page.getByTestId('lab-panel-consistency')).toHaveAttribute('data-state', 'ok');
  await shot(page, info, 'lab-live-ingest-clear');

  // 보내는 중 — 1초마다 점 · 행 수가 는다(진행 중에는 CH ≠ PG가 정상 — ✕를 내지 않는다)
  for (const n of [2, 4, 6]) {
    mock.state.current = run('ingest', 'running', stepsAt(INGEST_STEPS, 2), ingestResult(n), n);
    await expect(chart).toHaveAttribute('data-points', String(n));
    await expect(panel.getByTestId('ingest-live-sent')).toContainText(`${n * 10}만 행`);
    await expect(panel.getByTestId('ingest-live-rows')).toContainText(`CH ${n * 10 - 2}만`);
    await expect(panel.getByTestId('ingest-live-status')).toHaveText('넣는 중이에요');
    await expect(panel.getByTestId('ingest-chart-step')).toHaveCount(0);
    await expect(panel.getByTestId('ingest-same')).toHaveCount(0);
    await expect(panel.getByTestId('ingest-sentence')).toHaveCount(0);
  }
  // 디스크 막대 — 크기가 오면 자라고(넣는 중 표지) 배수는 그 순간 값
  const disk = panel.getByTestId('ingest-disk');
  await expect(disk).toHaveAttribute('data-live', 'true');
  await expect(disk).toContainText('디스크 크기(넣는 중)');
  await expect(disk).toContainText('45배');
  expect((await panel.getByTestId('ingest-disk-pg').boundingBox())?.width ?? 0).toBeGreaterThan(20);
  // 배수는 막대와 같은 지금 크기로 함께 바뀐다(사용자 지적 2026-10-12) — 크기가 바뀌면 다음 폴링에 배수 · 크기 글자가 같이 바뀐다
  mock.state.current = run(
    'ingest',
    'running',
    stepsAt(INGEST_STEPS, 2),
    {
      ...ingestResult(7),
      bytes: { clickhouse: 10_000_000, postgres: 120_000_000 },
    },
    7,
  );
  await expect(panel.getByTestId('ingest-disk-times')).toHaveText('12배지금 차이');
  await expect(disk).toContainText('10.0MB');
  await expect(disk).toContainText('120MB');
  await expect(panel.getByTestId('ingest-disk-uncompressed')).toHaveText('(압축 전)');
  await shot(page, info, 'lab-live-ingest-publish');

  // 재는 중에도 한 장에 — 반응형 단언
  await expectLiveFits(page, 'lab 넣는 중');

  // 맞춰 보는 중(최종값) → 완료 — 보관 결과를 다시 읽기 전(1.5초)에도 새 결과(✓ 83만 행)를 보이고 지난 결과로 돌아가지 않는다
  const final = ingestResult(8, { final: true });
  mock.state.current = run('ingest', 'running', stepsAt(INGEST_STEPS, 4), final, 8);
  await expect(panel.getByTestId('ingest-live-status')).toHaveText(
    '다 넣었어요 — 행 수 · 크기 맞춰 보는 중이에요',
  );
  await expect(panel.getByTestId('ingest-same')).toHaveCount(0);
  mock.complete(final, stepsAt(INGEST_STEPS, 5), 9);
  await expect(panel).toHaveAttribute('data-state', 'done');
  await expect(panel.getByTestId('ingest-same')).toHaveAttribute('data-same', 'true');
  await expect(panel.getByTestId('ingest-same')).toContainText('83만 행');
  await expect(panel).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
  await expect(chart).toHaveAttribute('data-points', '8');
  await expect(panel.getByTestId('ingest-sentence')).toContainText('두 DB에 똑같이 들어갔어요');
  expect(await seenCount(page), '시작한 뒤 지난 결과(1,996만 행)가 다시 보인 횟수').toBe(0);
  expect(
    await chart
      .locator('canvas')
      .first()
      .evaluate((el) => (el as unknown as { __keep?: boolean }).__keep === true),
    '비우는 중 → 보내는 중 → 방금 끝남 → 보관 결과 내내 같은 캔버스',
  ).toBe(true);
  await shot(page, info, 'lab-live-ingest-done');
});

const QUERY_STEPS = ['prepare', ...SIZES.map((x) => `rows-${x.target}`)];

/** 꺾은선의 단계 칸 i 가운데로 마우스를 옮긴다 — 축 단위 툴팁(trigger axis)이라 세로 자리는 상관없다 · 여백은 query-option grid와 같은 식 */
async function hoverQueryStep(page: Page, i: number) {
  const host = page.getByTestId('query-chart').locator('[role=img]');
  const box = await host.boundingBox();
  if (!box) throw new Error('조회 대결 그림 자리를 못 읽었다');
  const font = await host.evaluate((el) => Math.max(12, Number.parseFloat(getComputedStyle(el).fontSize)));
  const left = Math.round(font * 2.8);
  const right = Math.round(font * 2.6);
  const band = (box.width - left - right) / 9;
  await page.mouse.move(box.x + left + band * (i + 0.5), box.y + box.height * 0.4);
}

test('실시간 ② 조회 대결 — 단계 9칸(넣기 건수와 같은 10만 ~ 10억)을 늘 그리고 단계가 끝날 때마다 그 점이 생긴다 · 점을 가리키면 두 시간 · 차이', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const mock = await mockRuns(page, 'query');
  mock.state.current = run('query', 'running', stepsAt(QUERY_STEPS, 0), null, 1);
  await page.goto('/lab');
  await waitForScreen(page, 'lab');
  const panel = page.getByTestId('lab-panel-query');
  const chart = panel.getByTestId('query-chart');
  await expect(panel).toHaveAttribute('data-state', 'live');
  // 준비 중 — 지난 결과(점)는 지우고 9칸 모두 기다림 · 빈 축 + 지금 단계 한 줄
  await expect(chart).toHaveAttribute('data-phases', Array(9).fill('waiting').join(','));
  await expect(chart).toHaveAttribute('data-points', '0');
  await expect(panel.getByTestId('query-chart-step')).toHaveText('준비 중이에요');
  await expect(page.getByTestId('lab-panel-ingest')).toHaveAttribute('data-state', 'ok');
  // 그림 캔버스에 표시를 단다 — 끝날 때까지 같은 캔버스면 차트를 다시 만들지 않은 것
  await chart
    .locator('canvas')
    .first()
    .evaluate((el) => {
      (el as unknown as { __keep: boolean }).__keep = true;
    });

  const result = (k: number) => ({
    part: 'query',
    rows: 1_000_000_000,
    rangeStart: '2026-08-21T00:00:00.000Z',
    rangeEnd: '2026-10-10T02:30:05.000Z',
    sizes: SIZES.slice(0, k),
  });
  const detail = { prepare: { clickhouse: 1_000_000_000 } };
  for (const k of [0, 1, 4, 8]) {
    mock.state.current = run(
      'query',
      'running',
      stepsAt(QUERY_STEPS, k + 1, detail),
      k ? result(k) : null,
      k + 2,
    );
    const want = [...Array(k).fill('done'), 'running', ...Array(8 - k).fill('waiting')];
    await expect(chart).toHaveAttribute('data-phases', want.join(','));
    await expect(chart).toHaveAttribute('data-points', String(k));
    await expect(panel.getByTestId('query-running')).toContainText('행 재는 중…');
    await expect(panel.getByTestId('query-chart-step')).toHaveCount(0);
    await expect(page.getByText('넣은 데이터 10억 행', { exact: true })).toBeVisible();
  }
  await expect(panel.getByTestId('query-running')).toContainText('10억 행 재는 중…');
  await expect(panel.getByTestId('query-check')).toHaveCount(0);
  await shot(page, info, 'lab-live-query');
  await expectLiveFits(page, 'lab 조회 대결 재는 중');

  // 완료 — 다시 읽기 전에도 9칸 모두 끝난 점 · 그 뒤 보관 결과 · 내내 같은 캔버스
  mock.complete(result(9), stepsAt(QUERY_STEPS, 10, detail), 20);
  await expect(panel).toHaveAttribute('data-state', 'done');
  await expect(chart).toHaveAttribute('data-points', '9');
  await expect(panel).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
  await expect(chart).toHaveAttribute('data-phases', Array(9).fill('done').join(','));
  await expect(chart).toHaveAttribute('data-winners', 'pg,ch,ch,ch,ch,ch,ch,ch,ch');
  await expect(panel.getByTestId('query-running')).toHaveCount(0);
  expect(
    await chart
      .locator('canvas')
      .first()
      .evaluate((el) => (el as unknown as { __keep?: boolean }).__keep === true),
    '준비 중 → 재는 중 → 방금 끝남 → 보관 결과 내내 같은 캔버스',
  ).toBe(true);

  // 점을 가리키면 — 그 단계의 두 시간(같은 단위) · 몇 배 빠른지만(원천 행 수 · 정합성 글은 없다)
  await hoverQueryStep(page, 6);
  const tip = page.getByText('원천 1억 행', { exact: true });
  await expect(tip).toBeVisible();
  const box = tip.locator('xpath=..');
  await expect(box).toContainText('ClickHouse 0.88s');
  await expect(box).toContainText('PostgreSQL 2.13s');
  await expect(box).toContainText('CH 2.4배 빠름');
  await expect(box).not.toContainText('원천 행 수');
  await shot(page, info, 'lab-live-query-tooltip');
  await hoverQueryStep(page, 0);
  await expect(page.getByText('원천 10만 행', { exact: true }).locator('xpath=..')).toContainText(
    'PG 3.2배 빠름',
  );
  await page.mouse.move(0, 0);
  await shot(page, info, 'lab-live-query-done');
});

const CONSISTENCY_STEPS = ['prepare', 'clickhouse', 'postgres', 'compare'];

test('실시간 ③ 데이터 정합성 — 재는 동안에도 기준 4줄 표 · 다 잰 저장소 칸부터 값 · 판정은 끝난 뒤 · 끝나면 결론 · 다른 곳', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const mock = await mockRuns(page, 'consistency');
  mock.state.current = run('consistency', 'running', stepsAt(CONSISTENCY_STEPS, 1), CONSISTENCY_START, 1);
  await page.goto('/lab');
  await waitForScreen(page, 'lab');
  const panel = page.getByTestId('lab-panel-consistency');
  await expect(panel).toHaveAttribute('data-state', 'live');
  await expect(panel.getByTestId('consistency-headline')).toContainText('ClickHouse에서 재는 중이에요');
  await expect(panel.getByTestId('consistency-row')).toHaveCount(4);
  await expect(panel.locator('[data-testid=consistency-ch][data-phase=running]')).toHaveCount(4);
  await expect(panel.locator('[data-testid=consistency-pg][data-phase=waiting]')).toHaveCount(4);
  // ClickHouse를 다 쟀다 — CH 칸만 값 · PG는 지금 재는 중 · 판정은 아직
  mock.state.current = run(
    'consistency',
    'running',
    stepsAt(CONSISTENCY_STEPS, 2),
    { ...CONSISTENCY_START, clickhouse: CONSISTENCY_CH },
    2,
  );
  await expect(panel.getByTestId('consistency-headline')).toContainText('PostgreSQL에서 재는 중이에요');
  await expect(panel.locator('[data-testid=consistency-ch][data-phase=done]')).toHaveCount(4);
  await expect(panel.locator('[data-testid=consistency-pg][data-phase=running]')).toHaveCount(4);
  await expect(panel.locator('[data-testid=consistency-row][data-same=""]')).toHaveCount(4);
  await expect(panel.getByTestId('consistency-ch').first()).toHaveText('59,875,200행');
  await shot(page, info, 'lab-live-consistency');
  await expectLiveFits(page, 'lab 정합성 재는 중');

  mock.complete(CONSISTENCY, stepsAt(CONSISTENCY_STEPS, 4), 3);
  await expect(panel).toHaveAttribute('data-state', 'done');
  await expect(panel).toHaveAttribute('data-state', 'ok', { timeout: 10_000 });
  await expect(panel.getByTestId('consistency-headline')).toHaveText(
    '4가지 모두 달라요 — PostgreSQL에 49,994행이 적어요',
  );
  await expect(panel.locator('[data-testid=consistency-row][data-same=false]')).toHaveCount(4);
  // 판정 칸은 맞는지 안 맞는지만 · 얼마나 다른지는 툴팁 · 잰 구간 · 걸린 시간은 패널 맨 아래 잰 시각 줄 뒤(패널 본문 밖)
  await expect(panel.getByTestId('consistency-verdict').first()).toHaveText('다름');
  await expect(panel.getByTestId('consistency-verdict').first()).toHaveAttribute('title', 'PG 49,994행 적음');
  await expect(page.getByTestId('lab-measured-extra')).toContainText('다 훑는 데 PG 2.4s · CH 412ms');
  await expect(panel.getByTestId('consistency-where')).toHaveText(
    '다른 곳 129묶음 — L1-PRT 인쇄 · 잉크 온도 10/9 2시(PG 780행 적음) 등',
  );
  await expectLiveFits(page, 'lab 정합성 다름');
  await shot(page, info, 'lab-consistency-done');
});

test('데이터 정합성 10억 넣기 — 큰 값 합계(23자리)와 긴 판정도 칸 안에 한 줄 · 같으면 초록 · 맞춤 보기 4크기 스크롤 0', async ({
  page,
}, info) => {
  const mock = await mockRuns(page, 'consistency');
  const big = {
    rows: 1_000_000_000,
    sum: '733421987654321123',
    groups: 155_316,
    fingerprint: '-98234982349823498234982',
    scanMs: 51_200,
  };
  mock.state.latest = {
    ...OLD_LATEST,
    consistency: latestEntry(
      OLD_ID,
      'consistency',
      {
        ...CONSISTENCY,
        rangeStart: '2026-08-21T00:00:00.000Z',
        rangeEnd: '2026-10-10T02:30:05.000Z',
        clickhouse: big,
        postgres: { ...big, scanMs: 251_000 },
        checks: { rows: true, sum: true, groups: true, fingerprint: true },
        mismatchGroups: 0,
        diffGroups: 0,
        mismatches: [],
        match: true,
      },
      '2026-10-11T09:00:00.000Z',
    ),
  };
  await page.goto('/lab');
  await waitForScreen(page, 'lab');
  const panel = page.getByTestId('lab-panel-consistency');
  await expect(panel.getByTestId('consistency')).toHaveAttribute('data-match', 'true');
  await expect(panel.getByTestId('consistency-headline')).toHaveText(
    '4가지 기준이 모두 같아요 — 두 DB에 똑같이 들어갔어요',
  );
  await expect(panel.getByTestId('consistency-pg').nth(1)).toHaveText('733,421,987,654,321.123');
  await expect(panel.locator('[data-testid=consistency-row][data-same=true]')).toHaveCount(4);
  await expect(panel.getByTestId('consistency-where')).toHaveCount(0);
  await expectLiveFits(page, 'lab 정합성 10억');
  await shot(page, info, 'lab-consistency-1b');
});
