// /monitoring 실시간 연결 표지 문구 — 설계 .omc/plans/web-junior-redesign.md §4 용어표(쉬운 말) · 08_screen/01 §에러 코드별 사용자 표시 WebSocket 종료 코드 행
import { describe, expect, it } from 'vitest';
import { closedLabel, wsLabel } from '../components/shell/ws-indicator';

describe('실시간 연결 표지 — 쉬운 말 · 코드는 툴팁에만', () => {
  it('열림 — 구독 중이면 "실시간 연결됨" · 요청 중이면 확인 중', () => {
    expect(wsLabel('open', 'subscribed', null, null, 0).label).toBe('실시간 연결됨');
    expect(wsLabel('open', 'requesting', null, null, 0).label).toBe('실시간 연결 확인 중');
  });

  it('첫 연결 전(idle · connecting) — 끊김이 아니라 연결하는 중', () => {
    expect(wsLabel('idle', 'off', null, null, 0).label).toBe('실시간 연결하는 중');
    expect(wsLabel('connecting', 'requesting', null, null, 0).label).toBe('실시간 연결하는 중');
  });

  it('재연결 중 — 다음 시도까지 초 · 종료 코드는 툴팁', () => {
    const l = wsLabel('reconnecting', 'requesting', 4_200, 1006, 1_000);
    expect(l.label).toBe('연결이 끊겨 4초 뒤 다시 연결해요');
    expect(l.tip).toContain('종료 코드 1006');
    expect(wsLabel('reconnecting', 'requesting', null, 1006, 1_000).label).toBe(
      '연결이 끊겨 다시 연결하는 중',
    );
  });

  it('끊김 — 4403 · 4400 사유는 쉬운 말 · 숫자 코드는 문구에 없다', () => {
    const l = wsLabel('closed', 'requesting', null, 4403, 0);
    expect(l.label).toBe('연결이 끊겼어요 — 허용되지 않은 주소에서 접속했어요');
    expect(l.label).not.toMatch(/\d/);
    expect(l.tip).toContain('4403');
    expect(l.dot).toBe('bg-red-500');
    expect(closedLabel(4400)).toBe('연결이 끊겼어요 — 서버가 받을 수 없는 메시지였어요');
    expect(closedLabel(1000)).toBe('연결이 끊겼어요');
    expect(closedLabel(null)).toBe('연결이 끊겼어요');
  });
});
