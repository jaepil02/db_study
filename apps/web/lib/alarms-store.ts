// 알람 통지 겹침 층 — 정본 docs/08_screen/05_alarm_console.md §실시간 겹침
// 공통 셸이 ch:alarm 프레임을 받아 여기에 쌓고, ALM-CONSOLE이 목록 위에 띄운다. 통지는 저장이 아니라 알림이다 —
// 진실은 목록(alarm_event)이고 이 층은 세션 안에서 받은 것만 든다(Pub/Sub은 전달을 보장하지 않는다).
import { create } from 'zustand';
import { type AlarmFrame, applyAlarmFrame, type OverlayItem } from './alarms';

/** 세션 메모리 상한 — 콘솔을 열지 않은 채 오래 받은 통지가 쌓이지 않게 오래된 것부터 버린다(화면 조정값이 아니다) */
const OVERLAY_CAP = 200;

interface AlarmOverlayState {
  items: Record<number, OverlayItem>;
  push: (f: AlarmFrame, nowMs?: number) => void;
  /** 목록이 받아들인 행 제거 */
  drop: (eventIds: readonly number[]) => void;
  /** WebSocket 재연결 — 겹침 층을 비운다(끊긴 동안 놓친 통지는 목록 재조회가 메운다) */
  clear: () => void;
}

export const useAlarmOverlay = create<AlarmOverlayState>()((set) => ({
  items: {},
  push: (f, nowMs = Date.now()) =>
    set((s) => {
      const next = applyAlarmFrame(s.items, f, nowMs);
      const ids = Object.keys(next);
      if (ids.length <= OVERLAY_CAP) return { items: next };
      const keep = Object.values(next)
        .sort((a, b) => b.receivedAt - a.receivedAt)
        .slice(0, OVERLAY_CAP);
      return { items: Object.fromEntries(keep.map((i) => [i.eventId, i])) };
    }),
  drop: (eventIds) =>
    set((s) => {
      if (!eventIds.some((id) => s.items[id])) return s;
      const next = { ...s.items };
      for (const id of eventIds) delete next[id];
      return { items: next };
    }),
  clear: () => set({ items: {} }),
}));
