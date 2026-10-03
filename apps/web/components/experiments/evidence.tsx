'use client';
// 업무 보기(BFF 기록 읽기 /bff/measurements?view=evidence) — 성능 비교 화면의 업무 데이터 열(상황 카드 4)이 쓴다.
// 판독은 lib/evidence.ts(readEvidence · taskSummary · situationLines)가 하고 여기는 읽기 쿼리만 둔다 · 폴링하지 않는다.
import { useQuery } from '@tanstack/react-query';
import { entryReadOptions } from '../../lib/api';
import type { EvidenceResult } from '../../lib/evidence';

export type EvidenceBody = { readAt: number; evidence: EvidenceResult };

async function fetchEvidence(): Promise<EvidenceBody> {
  const res = await fetch('/bff/measurements?view=evidence', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as Partial<EvidenceBody>;
  if (!body.evidence) throw new Error('응답에 evidence가 없다');
  return body as EvidenceBody;
}

/** 업무 보기 — 진입 · 새로고침만 읽는다(entry는 화면 맨 위 관찰자만) · 포커스 재조회 없음 */
export function evidenceQueryOptions({ entry = false }: { entry?: boolean } = {}) {
  return {
    queryKey: ['measurements', 'evidence'] as const,
    queryFn: fetchEvidence,
    retry: false,
    ...entryReadOptions(entry),
  };
}

export function useEvidence(opts: { entry?: boolean } = {}) {
  return useQuery(evidenceQueryOptions(opts));
}
