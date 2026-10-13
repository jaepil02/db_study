// E2E 공용 — api 직결 주소 · 스크린샷 첨부
import { expect, type Page, type TestInfo } from '@playwright/test';

/** api 직결(테스트 러너 쪽 준비 · 정리용) — 화면 요청은 BFF(13001)를 탄다 */
export const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:13000';

/** 화면 캡처를 보고서에 붙인다 */
export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api/v1/${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

// ── 라이브 실행(07_api/09_datagen #2~#5) — 실행은 종류를 합쳐 동시 1 ──

export type RunStep = { key: string; status: string };
export type RunObj = {
  runId: string;
  type: 'flow';
  params: Record<string, number>;
  status: 'running' | 'stopping' | 'completed' | 'stopped' | 'failed';
  startedAt: string;
  endedAt: string | null;
  elapsedMs: number;
  steps: RunStep[];
};

export async function currentRun(): Promise<RunObj | null> {
  return (await apiGet<{ run: RunObj | null }>('runs/current')).run;
}

/** flow 실행을 api로 바로 시작한다(화면 조작 없이) — 202가 아니면 던진다 */
export async function startFlowRun(params: {
  pps: number;
  durationSec: number;
  bizPerSec: number;
  readsPerSec: number;
}): Promise<RunObj> {
  const res = await fetch(`${API}/api/v1/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'flow', params }),
  });
  if (res.status !== 202) throw new Error(`POST runs → ${res.status} ${await res.text()}`);
  return (await res.json()) as RunObj; // 본문 = 실행 객체(07_api/09 #2)
}

/** 진행 중 실행이 있으면 중단하고 종결까지 기다린다 — 다음 spec이 409를 맞지 않게 */
export async function settleRuns(timeoutMs = 60_000): Promise<void> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const r = await currentRun();
    if (!r || !['running', 'stopping'].includes(r.status)) return;
    // 상태를 바꾸는 POST는 JSON 본문 필수(api 규칙 · 중단은 빈 객체)
    if (r.status === 'running')
      await fetch(`${API}/api/v1/runs/${r.runId}/stop`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
    if (Date.now() > until) throw new Error(`실행 ${r.runId}이 ${timeoutMs}ms 안에 끝나지 않았다`);
    await new Promise((res) => setTimeout(res, 500));
  }
}

/** UTC ISO → "HH:MM:SS KST"(실행 패널 시각 표기) */
export const kstClock = (iso: string): string =>
  `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))} KST`;

/** 경과 문구("1분 42초" · "12.4초" · "1시간 3분 12초") → 초 */
export function elapsedSec(text: string): number {
  const h = /(\d+)시간/.exec(text)?.[1];
  const m = /(\d+)분/.exec(text)?.[1];
  const s = /([\d.]+)초/.exec(text)?.[1];
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

// ── 반응형 단언(정본 docs/08_screen/01_standards.md §반응형 규칙 규격 7 검사) — 7화면이 같은 도우미를 쓴다(웨이브 3 · w3-lab · w3-hmi도 import) ──
//
// 쓰는 법:
//   for (const vp of FIT_VIEWPORTS) {
//     await page.setViewportSize(vp);
//     await page.goto('/hmi');
//     await waitForScreen(page, 'hmi');          // [data-screen="hmi"]가 그려지고 글꼴 · 차트가 자리 잡을 때까지
//     await expectFits(page, `hmi ${vp.width}×${vp.height}`);
//   }
//   await page.setViewportSize(SMALL_VIEWPORT); await expectNoSideScroll(page, 'hmi 작은 화면');
// 목록형 상자는 components/shell/screen.tsx ScrollList(data-scroll-list)로 감싸면 그 안의 세로 스크롤은 허용된다.

/** 맞춤 보기 범위 — 이 크기에서는 페이지(문서 · 셸 본문) 스크롤 0 · 가로 넘침 0 · 잘린 상자 0 */
export const FIT_VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
] as const;

/** 지원 범위 밖 — 한 줄로 쌓고 세로 스크롤만(가로 스크롤 0) */
export const SMALL_VIEWPORT = { width: 1024, height: 768 } as const;

export interface FitReport {
  doc: { sw: number; cw: number; sh: number; ch: number; scrollY: number };
  body: { sw: number; cw: number; sh: number; ch: number };
  /** 목록형(data-scroll-list) 밖에서 내용이 넘쳐 잘리거나 스크롤이 생긴 상자 — "태그#data-testid|클래스 앞부분 (가로 sw/cw · 세로 sh/ch)" */
  clipped: string[];
}

/** 지금 화면의 넘침 측정 — 문서 · 셸 본문 · 본문 안 상자(목록형 상자 · 내비 · 장식 제외) */
export async function fitReport(page: Page): Promise<FitReport> {
  return page.evaluate(() => {
    const de = document.documentElement;
    const main = document.querySelector('[data-shell="content-body"]') as HTMLElement | null;
    const clipped: string[] = [];
    if (main)
      for (const el of main.querySelectorAll<HTMLElement>('*')) {
        if (el.closest('[data-scroll-list]') || el.closest('[aria-hidden="true"]')) continue;
        // 화면 읽기 전용 글(sr-only — 1px 상자에 일부러 가둔다)은 넘침이 아니다
        if (el.closest('.sr-only')) continue;
        if (el instanceof SVGElement || el.tagName === 'CANVAS') continue;
        const cs = getComputedStyle(el);
        const hides = (v: string) => v !== 'visible';
        const overX = hides(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
        const overY = hides(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
        // 말줄임(truncate)은 한 줄 이름이 칸보다 길 때 의도한 것 — 그래도 잘린 글은 보고한다
        if (overX || overY) {
          const id = el.getAttribute('data-testid') ?? el.className.toString().slice(0, 60);
          clipped.push(
            `${el.tagName.toLowerCase()}#${id} (가로 ${el.scrollWidth}/${el.clientWidth} · 세로 ${el.scrollHeight}/${el.clientHeight})`,
          );
        }
      }
    return {
      doc: {
        sw: de.scrollWidth,
        cw: de.clientWidth,
        sh: de.scrollHeight,
        ch: de.clientHeight,
        scrollY: window.scrollY,
      },
      body: main
        ? { sw: main.scrollWidth, cw: main.clientWidth, sh: main.scrollHeight, ch: main.clientHeight }
        : { sw: 0, cw: 0, sh: 0, ch: 0 },
      clipped,
    };
  });
}

/** 화면 틀이 그려지고 늦게 오는 데이터 · 글꼴 · 차트가 자리 잡을 때까지 기다린다 */
export async function waitForScreen(page: Page, id: string, settleMs = 1_500): Promise<void> {
  await page.locator(`[data-screen="${id}"]`).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settleMs);
}

/** 맞춤 보기 단언 — 문서 · 셸 본문 스크롤 0(세로 · 가로) · 목록형 밖 잘린 상자 0 */
export async function expectFits(page: Page, label: string): Promise<FitReport> {
  const r = await fitReport(page);
  expect(r.doc.scrollY, `${label} 문서 스크롤 위치`).toBe(0);
  expect(r.doc.sh, `${label} 문서 세로 넘침`).toBeLessThanOrEqual(r.doc.ch);
  expect(r.doc.sw, `${label} 문서 가로 넘침`).toBeLessThanOrEqual(r.doc.cw);
  expect(r.body.sh, `${label} 본문 세로 스크롤`).toBeLessThanOrEqual(r.body.ch + 1);
  expect(r.body.sw, `${label} 본문 가로 넘침`).toBeLessThanOrEqual(r.body.cw + 1);
  expect(r.clipped, `${label} 목록형 밖 잘린 상자`).toEqual([]);
  return r;
}

/** 작은 화면 단언 — 세로 스크롤은 허용 · 가로 넘침 0(문서 · 셸 본문) */
export async function expectNoSideScroll(page: Page, label: string): Promise<void> {
  const r = await fitReport(page);
  expect(r.doc.sw, `${label} 문서 가로 넘침`).toBeLessThanOrEqual(r.doc.cw);
  expect(r.body.sw, `${label} 본문 가로 넘침`).toBeLessThanOrEqual(r.body.cw + 1);
}
