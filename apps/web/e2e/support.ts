// E2E 공용 — api 직결 주소 · 실행 접미 · 스크린샷 첨부
import { randomUUID } from 'node:crypto';
import type { Page, TestInfo } from '@playwright/test';

/** api 직결(테스트 러너 쪽 준비 · 정리용) — 화면 요청은 BFF(3001)를 탄다 */
export const API = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';

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
