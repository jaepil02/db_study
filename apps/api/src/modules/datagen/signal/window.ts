// 창 하나 = 설비 묶음 × 연속 시점. 벡터 생성 → 엔트리 조립 → MessagePack 인코딩을 한 번에 한다.
// 이 함수는 워커 안에서 돈다(04_architecture/02 §worker_threads 격리 — 신호 생성 · 대량 인코딩).
import { encodeEntry, QUALITY } from '@db-study/shared';
import { initialState, valueAt } from './profiles';

export interface WindowTask {
  seed: number;
  firstDevice: number; // device_id(1부터)
  deviceCount: number;
  tagsPerDevice: number;
  profiles: Uint8Array; // 묶음 안 태그 순서 — deviceCount × tagsPerDevice
  k0: number; // 첫 시점 번호
  steps: number;
  startMs: number; // k = 0의 시각(epoch ms)
  periodMs: number;
  /** 상태형 프로파일의 직전 값 — 없으면 첫 창 */
  state: Float64Array | null;
}

export interface WindowResult {
  /** 인코딩된 엔트리를 이어 붙인 버퍼 · offsets[i]..offsets[i+1]이 엔트리 i */
  payload: Uint8Array;
  offsets: Uint32Array;
  entries: number;
  points: number;
  dropped: number;
  state: Float64Array;
  /** 워커가 이 창에 쓴 시간(ms) — 워커 안에서 채운다 */
  busyMs?: number;
}

/** tag_id 규칙 — 설비 순서대로 연번(시드 IDENTITY 발급 순서와 같은 모양) */
export function tagIdOf(deviceId: number, tagIndex: number, tagsPerDevice: number): number {
  return (deviceId - 1) * tagsPerDevice + tagIndex + 1;
}

export function generateWindow(t: WindowTask): WindowResult {
  const tags = t.deviceCount * t.tagsPerDevice;
  const state = t.state ?? new Float64Array(tags);
  if (!t.state) {
    for (let i = 0; i < tags; i++) {
      const dev = t.firstDevice + Math.floor(i / t.tagsPerDevice);
      state[i] = initialState(t.profiles[i] ?? 0, t.seed, tagIdOf(dev, i % t.tagsPerDevice, t.tagsPerDevice));
    }
  }
  const chunks: Uint8Array[] = [];
  const offsets = new Uint32Array(t.deviceCount * t.steps + 1);
  const tg = new Uint32Array(t.tagsPerDevice);
  const va = new Float64Array(t.tagsPerDevice);
  const q = new Uint8Array(t.tagsPerDevice).fill(QUALITY.SIMULATED);
  let bytes = 0;
  let points = 0;
  let dropped = 0;
  let e = 0;
  for (let s = 0; s < t.steps; s++) {
    const k = t.k0 + s;
    const ts = t.startMs + k * t.periodMs;
    for (let d = 0; d < t.deviceCount; d++) {
      const dev = t.firstDevice + d;
      let n = 0;
      for (let j = 0; j < t.tagsPerDevice; j++) {
        const i = d * t.tagsPerDevice + j;
        const tagId = tagIdOf(dev, j, t.tagsPerDevice);
        const v = valueAt(t.profiles[i] ?? 0, t.seed, tagId, k, state, i);
        if (Number.isNaN(v)) {
          dropped++;
          continue;
        }
        tg[n] = tagId;
        va[n] = v;
        n++;
      }
      // 생성 모드의 엔트리 = 설비 하나의 시점 하나 → t0 = ts · dt 전부 0
      const buf = encodeEntry({
        d: dev,
        s: k,
        t0: ts,
        tg: tg.subarray(0, n),
        dt: new Int32Array(n),
        va: va.subarray(0, n),
        q: q.subarray(0, n),
      });
      chunks.push(buf);
      bytes += buf.length;
      points += n;
      offsets[++e] = bytes;
    }
  }
  const payload = new Uint8Array(bytes);
  let at = 0;
  for (const c of chunks) {
    payload.set(c, at);
    at += c.length;
  }
  return { payload, offsets, entries: e, points, dropped, state };
}
