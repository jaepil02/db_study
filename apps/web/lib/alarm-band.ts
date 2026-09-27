// 활성 알람 띠 세션 목록 — 정본 docs/08_screen/03_realtime_dashboard.md §갱신과 값 병합 "띠는 이 세션에서 받은 이벤트만" · §장애 시 보이는 것
// ALM-CONSOLE 겹침 층(lib/alarms-store)과 수명이 다르다 — 겹침 행은 목록에 나타나면 지워지고(drop) 재연결 때 비워지지만(clear),
// 띠는 이 세션에서 받은 통지를 그대로 든다. 같은 층을 쓰면 콘솔을 한 번 열거나 재연결이 한 번 일어나는 것만으로 띠의 통지가 사라진다.
// 프레임에 설비가 없어(tagId만 — 07_api/11 alarm) 설비 판정은 띠가 보는 설비의 태그 목록으로 한다.
import { create } from 'zustand';
import { type AlarmFrame, applyAlarmFrame, type OverlayItem } from './alarms';

/** 세션 메모리 상한 — 대시보드를 오래 띄운 탭에 통지가 끝없이 쌓이지 않게 오래 받은 것부터 버린다(화면 조정값이 아니다) */
export const BAND_CAP = 200;

/** 프레임 하나를 세션 목록에 합친다 — 같은 eventId의 열림 · 닫힘은 한 행 · 상한을 넘으면 오래 받은 것부터 버린다 */
export function pushBandItem(
  items: Readonly<Record<number, OverlayItem>>,
  f: AlarmFrame,
  nowMs: number,
  cap = BAND_CAP,
): Record<number, OverlayItem> {
  const next = applyAlarmFrame(items, f, nowMs);
  const all = Object.values(next);
  if (all.length <= cap) return next;
  const keep = all.sort((a, b) => b.receivedAt - a.receivedAt).slice(0, cap);
  return Object.fromEntries(keep.map((i) => [i.eventId, i]));
}

export type BandState =
  /** 통지 경로 끊김(WebSocket 연결 아님 · 실시간 저장소 503) — 받은 통지는 남기되 새 통지가 오지 않음을 보인다 */
  | { kind: 'down'; items: OverlayItem[]; tagsKnown: boolean }
  /** 설비 태그 목록을 아직 못 읽음 — 통지를 이 설비로 가를 수 없다("없음"이라 말하지 않는다) */
  | { kind: 'unknown'; received: number }
  | { kind: 'items'; items: OverlayItem[] }
  | { kind: 'none' };

/**
 * 띠 표시 판정. tagIds = 이 설비의 태그(최신값 응답의 메타) · null이면 아직 모른다.
 * 태그를 모르는 채 "통지 없음"을 보이면 Redis 503(메타가 비는 장애)에서 받은 통지를 전부 가리고 없다고 말한다.
 */
export function bandState(
  items: Readonly<Record<number, OverlayItem>>,
  tagIds: ReadonlySet<number> | null,
  down: boolean,
): BandState {
  const all = Object.values(items);
  const mine = tagIds === null ? [] : all.filter((i) => tagIds.has(i.tagId));
  mine.sort((a, b) => b.receivedAt - a.receivedAt);
  if (down) return { kind: 'down', items: mine, tagsKnown: tagIds !== null };
  if (tagIds === null) return { kind: 'unknown', received: all.length };
  return mine.length > 0 ? { kind: 'items', items: mine } : { kind: 'none' };
}

interface AlarmBandState {
  items: Record<number, OverlayItem>;
  push: (f: AlarmFrame, nowMs?: number) => void;
}

/** 공통 셸 알람 수신부가 싣는다 — 재연결 · 콘솔 목록 반영으로 비우지 않는다 */
export const useAlarmBandStore = create<AlarmBandState>()((set) => ({
  items: {},
  push: (f, nowMs = Date.now()) => set((s) => ({ items: pushBandItem(s.items, f, nowMs) })),
}));
