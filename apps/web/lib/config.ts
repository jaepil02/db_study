// 화면 조정값 현행값 — 정본 docs/09_tech_stack/01_frontend.md §화면 조정값 현행값 · §TanStack Query 설정값
// 계약은 08_screen(01 · 03 · 07)이 갖고 값은 09_tech_stack/01이 갖는다 — 여기서 새 값을 정하지 않는다.

/** 트렌드 창 길이 5분(S2 고정) */
export const TREND_WINDOW_MS = 5 * 60_000;
/** 링 버퍼 태그당 슬롯 = 트렌드 창 ÷ SW-07 스로틀 창(100 ms) = 3,000 */
export const RING_CAPACITY = 3_000;
/** 트렌드 최대 태그 수 8 */
export const TREND_MAX_TAGS = 8;
/** 콘솔 폴링 15초 — 스크레이프 주기보다 짧지 않게(08_screen/07) */
export const CONSOLE_POLL_MS = 15_000;
/** 시계열 쿼리 gcTime 60초 */
export const TIMESERIES_GC_MS = 60_000;

// WebSocket 조정값 — 소유 docs/07_api/11_websocket.md §연결 관리와 재연결(현행 참고)
/** 서버 JSON ping 주기 30초 × 한도 3회 — 이 동안 ping이 없으면 클라이언트가 닫고 재연결한다 */
export const WS_PING_INTERVAL_MS = 30_000;
export const WS_PING_MISS_LIMIT = 3;
/** 재연결 지수 백오프 1 · 2 · 4초 … 최대 30초 */
export const WS_BACKOFF_START_MS = 1_000;
export const WS_BACKOFF_MAX_MS = 30_000;

/**
 * 브라우저 직결 api 주소(09_tech_stack/04 §환경변수 — 기본 http://localhost:3000).
 * 화면은 http://localhost:3001로 연다 — api CORS · WS Origin 허용 오리진이 http://localhost:3001 하나라
 * 127.0.0.1:3001로 열면 오리진 문자열이 달라 직결 요청이 막힌다.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

/** 직결 WebSocket 주소 — http(s) → ws(s) */
export function wsUrl(base: string = API_BASE_URL): string {
  return `${base.replace(/^http/, 'ws').replace(/\/$/, '')}/ws/realtime`;
}
