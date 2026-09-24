// 실시간 스토어(Zustand) — 계약 docs/09_tech_stack/01_frontend.md §실시간 스토어와 WebSocket 래퍼
// 태그별 최신값 · 메타 · 링 버퍼를 담는다. 링 버퍼는 Map 참조 하나를 계속 쓰고(교체하지 않는다) seq로 변경을 알린다.
import { create } from 'zustand';
import { RING_CAPACITY } from './config';
import { clockOffsetMs, mergeLatest, type TagLatest } from './latest';
import { TagRingBuffer } from './ring-buffer';
import type { LatestDeviceBody, TimeseriesQueryBody, WsServerMessageBody } from './shared';

export interface TagMeta {
  tagCode: string | null;
  tagName: string | null;
  unit: string | null;
  staleAfterMs: number | null;
}

type RtFrame = Extract<WsServerMessageBody, { type: 'rt' }>;

export interface RealtimeState {
  deviceId: number | null;
  /** 표 순서 — REST items 순서 + 프레임으로만 본 태그는 뒤에 */
  order: number[];
  latest: Record<number, TagLatest>;
  meta: Record<number, TagMeta>;
  /** 추정 서버 현재 − 브라우저 현재 */
  offsetMs: number;
  /** 태그별 링 버퍼 — 참조는 고정 · 내용만 바뀐다 */
  buffers: Map<number, TagRingBuffer>;
  /** 버퍼 변경 카운터 — 차트가 구독해 다시 그린다 */
  seq: number;
  resetDevice(deviceId: number): void;
  applyRest(body: LatestDeviceBody, receivedAt: number): void;
  applyFrame(frame: RtFrame): void;
  applyHistory(deviceId: number, body: TimeseriesQueryBody): void;
}

function bufferOf(buffers: Map<number, TagRingBuffer>, tagId: number): TagRingBuffer {
  let b = buffers.get(tagId);
  if (!b) {
    b = new TagRingBuffer(RING_CAPACITY);
    buffers.set(tagId, b);
  }
  return b;
}

export const useRealtimeStore = create<RealtimeState>()((set, get) => ({
  deviceId: null,
  order: [],
  latest: {},
  meta: {},
  offsetMs: 0,
  buffers: new Map(),
  seq: 0,

  // 설비 전환 — 이전 설비 값을 남기면 다른 설비 값을 이 설비로 읽는다(08_screen/03 상태 4행 로딩)
  resetDevice(deviceId) {
    const s = get();
    if (s.deviceId === deviceId) return;
    for (const b of s.buffers.values()) b.clear();
    s.buffers.clear();
    set({ deviceId, order: [], latest: {}, meta: {}, offsetMs: 0, seq: s.seq + 1 });
  },

  applyRest(body, receivedAt) {
    const s = get();
    if (body.meta.deviceId !== s.deviceId) return;
    const latest = { ...s.latest };
    const meta = { ...s.meta };
    const order = [...s.order];
    const seen = new Set(order);
    for (const item of body.items) {
      meta[item.tagId] = {
        tagCode: item.tagCode,
        tagName: item.tagName,
        unit: item.unit,
        staleAfterMs: item.staleAfterMs,
      };
      const merged = mergeLatest(latest[item.tagId], item, 'rest');
      if (merged) latest[item.tagId] = merged;
      bufferOf(s.buffers, item.tagId).push(item.ts, item.value);
      if (!seen.has(item.tagId)) {
        seen.add(item.tagId);
        order.push(item.tagId);
      }
    }
    // REST가 준 순서를 앞에 둔다 — 프레임이 먼저 만든 행은 REST 순서로 재배열
    const restOrder = body.items.map((i) => i.tagId);
    const restSet = new Set(restOrder);
    const nextOrder = [...restOrder, ...order.filter((id) => !restSet.has(id))];
    set({
      latest,
      meta,
      order: nextOrder,
      offsetMs: clockOffsetMs(body.meta.servedAt, receivedAt),
      seq: s.seq + 1,
    });
  },

  applyFrame(frame) {
    const s = get();
    if (s.deviceId === null) return;
    let latest: Record<number, TagLatest> | null = null;
    let order: number[] | null = null;
    let touched = false;
    for (const dev of frame.devices) {
      if (dev.deviceId !== s.deviceId) continue; // 이전 설비 프레임이 새 설비 표에 섞이지 않게
      for (const [tagId, ts, value, quality] of dev.tags) {
        const prev = (latest ?? s.latest)[tagId];
        const merged = mergeLatest(prev, { tagId, ts, value, quality }, 'ws');
        if (merged && merged !== prev) {
          latest ??= { ...s.latest };
          latest[tagId] = merged;
          if (prev === undefined) {
            order ??= [...s.order];
            order.push(tagId);
          }
        }
        if (bufferOf(s.buffers, tagId).push(ts, value)) touched = true;
      }
    }
    if (latest === null && !touched) return;
    set({ ...(latest ? { latest } : {}), ...(order ? { order } : {}), seq: s.seq + 1 });
  },

  // 트렌드 과거 채움 — 첫 열 ts · 값 열은 둘째 열(raw는 value · 서버가 해상도를 올리면 첫 집계 열)
  applyHistory(deviceId, body) {
    const s = get();
    if (deviceId !== s.deviceId) return;
    let n = 0;
    for (const series of body.series) {
      const ts: number[] = [];
      const vals: number[] = [];
      for (const p of series.points) {
        const t = p[0];
        const v = p[1];
        if (t == null || v == null) continue;
        ts.push(t);
        vals.push(v);
      }
      n += bufferOf(s.buffers, series.tagId).prepend(ts, vals);
    }
    if (n > 0) set({ seq: s.seq + 1 });
  },
}));
