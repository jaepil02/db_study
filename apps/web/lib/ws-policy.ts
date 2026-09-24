// WebSocket 재연결 판정 · 백오프 — 정본 docs/07_api/11_websocket.md §종료 코드 · §연결 관리와 재연결
import { WS_BACKOFF_MAX_MS, WS_BACKOFF_START_MS } from './config';
import { WS_CLOSE, WS_RECONNECT, type WsCloseReason } from './shared';

const REASON_BY_CODE = new Map<number, WsCloseReason>(
  (Object.entries(WS_CLOSE) as [WsCloseReason, number][]).map(([reason, code]) => [code, reason]),
);

/**
 * 종료 코드 → 재연결 여부. 계약 8종은 WS_RECONNECT를 따른다.
 * 4401(갱신 후 1회)은 S2에 인증 · BFF 갱신이 없어 갱신할 토큰이 없다 — 재연결하지 않고 끊김으로 둔다.
 * 계약 밖 코드(1006 비정상 종료 · 핸드셰이크 실패 등)는 네트워크 단절과 같아 백오프 재연결한다.
 */
export function shouldReconnect(code: number): boolean {
  const reason = REASON_BY_CODE.get(code);
  if (reason === undefined) return true;
  return WS_RECONNECT[reason] === 'yes';
}

/** 지수 백오프 1 · 2 · 4초 … 최대 30초 — attempt는 0부터 */
export function backoffMs(attempt: number): number {
  return Math.min(WS_BACKOFF_START_MS * 2 ** attempt, WS_BACKOFF_MAX_MS);
}
