// health 읽기(BFF 경유) — EXP-CONSOLE 폴링 · 공통 셸 실험 조건 배지 · DSH 구성 배지가 같은 쿼리 키(obs · health)를 나눠 쓴다
// (08_screen/01 §갱신 주기와 캐시 층 정렬 — health staleTime 0 · 화면별 폴링 · 셸은 진입 1회).
import { ApiError } from './api';
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
