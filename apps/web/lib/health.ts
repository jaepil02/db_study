// health 읽기(BFF 경유) — 두 화면의 측정 조건(스위치 상태) 읽기가 같은 쿼리 키(obs · health)를 나눠 쓴다.
import { useQuery } from '@tanstack/react-query';
import { ApiError, entryReadOptions } from './api';
import { HealthResponse } from './shared';

export const HEALTH_KEY = ['obs', 'health'] as const;

export async function fetchHealth() {
  let res: Response;
  try {
    res = await fetch('/bff/health', { cache: 'no-store' });
  } catch {
    throw new ApiError(0, null, 'BFF에 닿지 못했다');
  }
  // 200 · 503 모두 같은 본문 — 503은 오류가 아니라 저장소별 상태로 그린다(REQ-OBS-09)
  if (res.status !== 200 && res.status !== 503) throw new ApiError(res.status, null, `HTTP ${res.status}`);
  return { httpStatus: res.status, body: HealthResponse.parse(await res.json()) };
}

/**
 * health 쿼리 옵션 — 진입 1회 · 폴링 · 포커스 재조회 없음(08_screen/08 §호출 표면 · 갱신) · 두 화면의 각주 툴팁이 읽는다.
 * entry는 화면 맨 위 관찰자(EXP-PERF · EXP-FLOW 화면)만 — 다시 붙는 다른 관찰자는 다시 읽지 않는다.
 */
export function healthQueryOptions({ entry = false }: { entry?: boolean } = {}) {
  return {
    queryKey: HEALTH_KEY,
    queryFn: fetchHealth,
    retry: false,
    ...entryReadOptions(entry),
  };
}

export function useShellHealth(opts: { entry?: boolean } = {}) {
  return useQuery(healthQueryOptions(opts));
}
