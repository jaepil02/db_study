// E2E 공용 — api 직결 주소 · 실행 접미 · 스크린샷 첨부
import { randomUUID } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';

/** api 직결(테스트 러너 쪽 준비 · 정리용) — 화면 요청은 BFF(13001)를 탄다 */
export const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:13000';

/** 실행마다 다른 접미 — 테스트가 만든 데이터는 E2E- 접두 + 이 접미로 남는다 */
export const runSuffix = (): string =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, '0')}`.toUpperCase();

export const IDEMPOTENCY = 'idempotency-key';

/** 화면 캡처를 보고서에 붙인다 */
export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await info.attach(name, { body: await page.screenshot({ fullPage: false }), contentType: 'image/png' });
}

/** api 직결 쓰기(정리 · 준비) — 명령 경로라 Idempotency-Key를 싣는다 */
export async function apiWrite(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API}/api/v1/${path}`, {
    method,
    headers: { 'content-type': 'application/json', [IDEMPOTENCY]: randomUUID() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/api/v1/${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

// ── 라이브 실행(07_api/09_datagen #2~#5) — 실행은 두 종류를 합쳐 동시 1 ──

export type RunStep = { key: string; status: string };
export type RunObj = {
  runId: string;
  type: 'perf' | 'flow';
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

/** 센서 자동 생성 게이트(health run.sensorAutogen) — 로컬 Compose 기본 off · 실험 러너는 on(09_tech_stack/04) */
export async function sensorAutogen(): Promise<'on' | 'off'> {
  const res = await fetch(`${API}/api/v1/health`);
  // 200 · 503 모두 같은 본문(저장소 하나가 내려가도 run은 읽힌다)
  if (res.status !== 200 && res.status !== 503) throw new Error(`GET health → ${res.status}`);
  return ((await res.json()) as { run: { sensorAutogen: 'on' | 'off' } }).run.sensorAutogen;
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
    if (r.status === 'running') await fetch(`${API}/api/v1/runs/${r.runId}/stop`, { method: 'POST' });
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
