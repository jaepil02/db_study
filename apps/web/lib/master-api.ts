// 마스터 표면 호출 — 전부 BFF 경유(/bff/master/{path} → api /api/v1/{path}) · 정본 docs/08_screen/06_master_admin.md
// 조회는 BFF 서버 fetch 캐시(revalidate 30초)를 지나고, 쓰기 성공은 BFF가 revalidateTag(⑤)한다.
import { requestJson } from './api';

/**
 * 신호 뒤 신선 창 — ⑥(신호)이 ③ 시점에 발화해 ⑤(BFF revalidateTag · api 응답 뒤)보다 먼저 BFF에 닿을 수 있다(검수 M5).
 * 창 안의 조회는 x-bff-fresh를 달아 BFF가 서버 사본을 거치지 않고 api를 읽게 한다 — 사건 순서와 무관하게 신호 뒤 첫 읽기가 새 값이다.
 */
const FRESH_WINDOW_MS = 2000;
let freshUntil = 0;
export function markMasterFresh(nowMs = Date.now()): void {
  freshUntil = nowMs + FRESH_WINDOW_MS;
}

export async function bffGet<T>(path: string, schema: { parse(x: unknown): T }): Promise<T> {
  const r = await requestJson(
    `/bff/master/${path}`,
    Date.now() < freshUntil ? { headers: { 'x-bff-fresh': '1' } } : undefined,
  );
  return schema.parse(r.body);
}

export async function bffWrite(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  body: unknown,
): Promise<unknown> {
  const r = await requestJson(`/bff/master/${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.body;
}

/** 루프백 host — SIMULATED 표지(REQ-MST-03 · 그 설비의 정상 값은 품질 9로 적재된다) */
export function isLoopbackHost(host: string): boolean {
  return /^127\./.test(host) || host === '::1';
}

/** 편집 폼 값 → PATCH 본문 — 바뀐 필드만(변경 없음이면 빈 객체 · 서버도 감사 · 체인을 걸지 않는다) */
export function changedFields<T extends Record<string, unknown>>(before: T, after: Partial<T>): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(after)) {
    if (v !== undefined && before[k] !== v) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/** Modbus 매핑 4필드 — 바꾸면 같은 tag_id의 값 원천이 바뀐다(저장 전 경고 · 07_api/04 미확인) */
export const MODBUS_MAPPING_FIELDS = ['functionCode', 'address', 'dataType', 'wordOrder'] as const;
