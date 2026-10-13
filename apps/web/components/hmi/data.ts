// ⑦ HMI 읽기 — 개요(BFF /bff/plant/overview · 1초마다)와 고른 설비의 최근 10분(api 직결 POST /api/v1/timeseries/query · 5초마다).
// 배정은 07_api/01 §BFF 경유와 직결 그대로 — 개요는 api가 BFF 경유 표면(CORS 없음)으로 냈고, 시계열 조회는 직결 표면이다(CORS 허용 오리진 http://localhost:13001).
// 판독은 lib/hmi.ts가 한다. 정본 docs/08_screen/11_hmi_screen.md §호출 표면 · 갱신(개요는 1초마다 · 상세 추이는 5초마다).
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL, TIMESERIES_GC_MS } from '../../lib/config';
import { readTrend, type TrendRead, trendRequest } from '../../lib/hmi';
import { PlantOverview, type PlantOverviewBody, TimeseriesQueryResponse } from '../../lib/shared';

/** 개요 주기 1초 · 최근 10분 주기 5초 */
export const OVERVIEW_POLL_MS = 1_000;
export const TREND_POLL_MS = 5_000;

export const hmiKeys = {
  overview: ['plant', 'overview'] as const,
  trend: (deviceId: number) => ['plant', 'trend', deviceId] as const,
};

async function fetchOverview(): Promise<PlantOverviewBody> {
  const res = await fetch('/bff/plant/overview', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const r = PlantOverview.safeParse(await res.json());
  if (!r.success) throw new Error('개요 형식이 계약과 다르다');
  return r.data;
}

/** 개요 — 실패해도 마지막 응답을 들고(TanStack Query는 오류 때 data를 지우지 않는다) 1초 뒤 다시 읽는다 · 탭이 가려지면 멈춘다 */
export function usePlantOverview() {
  return useQuery({
    queryKey: hmiKeys.overview,
    queryFn: fetchOverview,
    staleTime: 0,
    refetchInterval: OVERVIEW_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

async function fetchTrend(tagIds: readonly number[]): Promise<TrendRead> {
  const now = Date.now();
  const res = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/v1/timeseries/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(trendRequest(tagIds, now)),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const r = TimeseriesQueryResponse.safeParse(await res.json());
  if (!r.success) throw new Error('시계열 응답 형식이 계약과 다르다');
  return readTrend(r.data, now);
}

/** 고른 설비 태그들의 최근 10분 — 설비마다 캐시(다시 고르면 바로 보이고 5초 안에 새로 읽는다) */
export function useDeviceTrend(deviceId: number | null, tagIds: readonly number[]) {
  return useQuery({
    queryKey: hmiKeys.trend(deviceId ?? 0),
    queryFn: () => fetchTrend(tagIds),
    enabled: deviceId !== null && tagIds.length > 0,
    staleTime: 0,
    gcTime: TIMESERIES_GC_MS,
    refetchInterval: TREND_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
