// SW-07 WS_THROTTLE_MS — FrameThrottlePort(정본 04_architecture/02 · 계약 07_api/11 §스로틀 병합)
// 창 > 0 = WindowMergeThrottle — 연결마다 창 안 같은 태그는 ts가 가장 큰 값 하나 · 창 끝에 rt 프레임 1회
// 창 0 = PassthroughThrottle — 병합 없이 받은 대로 즉시 전송(프레임 모양은 같다) · 창 0의 병합 구현을 만들지 않는다
// 병합 대상은 ch:rt뿐 — alarm · cacheinv는 즉시 · 병합 없음(무효화 신호를 병합하면 키가 빠진다).
import type { LatestTuple } from '../../common/redis/durable-key-client';

export const FRAME_THROTTLE_PORT = Symbol('FrameThrottlePort');

/** 연결 하나의 대기 — 설비 → 태그 → ts 최대 튜플 */
export type Pending = Map<number, Map<number, LatestTuple>>;
export type RtDevices = { deviceId: number; tags: LatestTuple[] }[];

export interface FrameThrottlePort {
  readonly implName: 'WindowMergeThrottle' | 'PassthroughThrottle';
  /** 창 끝 타이머 주기(ms) — Passthrough는 0(타이머 없음) */
  readonly windowMs: number;
  /** 수신 — 즉시 보낼 프레임이 있으면 돌려준다 · merged = 병합으로 버린 갱신 수(rlt_throttle_merged_total) */
  offer(
    pending: Pending,
    deviceId: number,
    tuples: readonly LatestTuple[],
  ): { frame: RtDevices | null; merged: number };
  /** 창 끝 — 대기를 비우고 프레임을 만든다(한 창에 변화가 없으면 null) */
  drain(pending: Pending): RtDevices | null;
}

export class WindowMergeThrottle implements FrameThrottlePort {
  readonly implName = 'WindowMergeThrottle' as const;
  constructor(readonly windowMs: number) {
    if (!(windowMs > 0))
      throw new Error('WindowMergeThrottle 창은 0보다 커야 한다 — 0은 PassthroughThrottle');
  }
  offer(pending: Pending, deviceId: number, tuples: readonly LatestTuple[]) {
    let tags = pending.get(deviceId);
    if (!tags) {
      tags = new Map();
      pending.set(deviceId, tags);
    }
    let merged = 0;
    for (const t of tuples) {
      const prev = tags.get(t[0]);
      // 병합 기준은 도착 순이 아니라 ts 최대값 — 조건부 쓰기와 같은 기준이라 화면이 뒤로 가지 않는다
      if (!prev) tags.set(t[0], t);
      else {
        merged++;
        if (t[1] >= prev[1]) tags.set(t[0], t);
      }
    }
    return { frame: null, merged };
  }
  drain(pending: Pending): RtDevices | null {
    if (pending.size === 0) return null;
    const devices = [...pending].map(([deviceId, tags]) => ({ deviceId, tags: [...tags.values()] }));
    pending.clear();
    return devices;
  }
}

export class PassthroughThrottle implements FrameThrottlePort {
  readonly implName = 'PassthroughThrottle' as const;
  readonly windowMs = 0;
  offer(_pending: Pending, deviceId: number, tuples: readonly LatestTuple[]) {
    return { frame: [{ deviceId, tags: [...tuples] }], merged: 0 };
  }
  drain(): RtDevices | null {
    return null;
  }
}
