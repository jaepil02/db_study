// 성능 보기 읽기 — BFF 기록 읽기 /bff/measurements?view=perf(판독 P1~P6은 lib/perf.ts readPerf) · 폴링하지 않는다(진입 · 새로고침만).
import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { entryReadOptions } from '../../../lib/api';
import { TIMESERIES_GC_MS } from '../../../lib/config';
import type { PerfView } from '../../../lib/perf';

export type PerfResponse = PerfView & { readAt: number };

async function fetchPerf(): Promise<PerfResponse> {
  const res = await fetch('/bff/measurements?view=perf', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as PerfResponse;
}

/** 쿼리 키 measurements · perf · staleTime 0(화면 진입 관찰자 하나) · 응답이 수백 KB라 짧은 gcTime(09_tech_stack/01 §gcTime) */
export const perfViewQueryOptions = () => ({
  queryKey: ['measurements', 'perf'] as const,
  queryFn: fetchPerf,
  gcTime: TIMESERIES_GC_MS,
  retry: false,
  ...entryReadOptions(true),
});

export function usePerfView(): UseQueryResult<PerfResponse> {
  return useQuery(perfViewQueryOptions());
}
