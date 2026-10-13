// ⑤ 직접 비교 최근 결과 읽기(/bff/runs/latest?type=compare).
// 폴링하지 않는다 — 화면에 들어올 때 1회 · 새로고침만(lib/api.ts entryReadOptions).
import { useQuery } from '@tanstack/react-query';
import { entryReadOptions } from '../../lib/api';
import {
  COMPARE_PARTS,
  CompareAttempt,
  type CompareLatestBodyType,
  CompareLatestEntry,
  type ComparePart,
} from '../../lib/shared';

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface CompareLatestRead {
  body: CompareLatestBodyType;
  /** 모양이 계약(CompareLatestEntry)과 달라 읽지 못한 부분 — 그 부분만 null로 두고 나머지는 그대로 쓴다 */
  failed: ComparePart[];
}

/** 응답 → 부분별 최근 완료 결과 · 마지막 시도 — 부분마다 따로 검사한다(옛 결과 한 부분이 계약과 달라도 다른 부분은 보인다) · 시도가 없거나 모양이 다르면 null */
export function readCompareLatest(raw: unknown): CompareLatestRead {
  if (!raw || typeof raw !== 'object') throw new Error('직접 비교 결과가 객체가 아니다');
  const r = raw as Record<string, unknown>;
  const tries = (r.attempts && typeof r.attempts === 'object' ? r.attempts : {}) as Record<string, unknown>;
  const body: CompareLatestBodyType = {
    ingest: null,
    query: null,
    consistency: null,
    attempts: { ingest: null, query: null, consistency: null },
  };
  const failed: ComparePart[] = [];
  for (const part of COMPARE_PARTS) {
    const v = r[part];
    if (v !== null && v !== undefined) {
      const parsed = CompareLatestEntry.safeParse(v);
      if (parsed.success) body[part] = parsed.data;
      else failed.push(part);
    }
    const a = CompareAttempt.safeParse(tries[part]);
    if (a.success) body.attempts[part] = a.data;
  }
  return { body, failed };
}

/** ⑤ 직접 비교 부분별 최근 결과(GET /bff/runs/latest?type=compare) */
export function useCompareLatest() {
  return useQuery({
    queryKey: ['runs', 'latest', 'compare'] as const,
    queryFn: async (): Promise<CompareLatestRead> =>
      readCompareLatest(await getJson('/bff/runs/latest?type=compare')),
    retry: false,
    ...entryReadOptions(true),
  });
}
