// 모드 B 엔트리 생성(GEN-06) — 엔트리 = 설비 하나의 시점 하나 · Collector와 같은 페이로드 계약(StreamEntryV1)
// 품질 전부 SIMULATED(9) · DROPOUT은 행 생략(BAD를 달지 않는다 — 06_pipeline/10 §생성 엔진에서 모드까지).
// 태그 집합은 티어 시드와 같은 (device_id · tag_id) — tag_master에서 읽은 것을 받는다(tagIdOf 공식으로 추정하지 않는다).
import { encodeEntry, QUALITY, SIGNAL_PROFILES } from '@db-study/shared';
import { type ProfileMix, profileFor } from '../signal/assignment';
import { initialState, valueAt } from '../signal/profiles';

export interface ModeBDevice {
  deviceId: number;
  tagIds: number[];
}

/**
 * 해독 불가 페이로드(EXP-19) — msgpack 맵 머리(1쌍) + 키 "v"에서 끊긴 바이트. 소비자의 unpack이 던진다(DLQ 사유 undecodable).
 * 알 수 없는 v(스키마 버전)와 가르기 위해 "읽을 수 없는 바이트"를 고른다.
 */
export const UNDECODABLE_PAYLOAD: Buffer = Buffer.from([0x81, 0xa1, 0x76]);

export interface GeneratedEntry {
  payload: Buffer;
  points: number;
}

export interface GeneratedStep {
  entries: GeneratedEntry[];
  points: number;
  dropped: number;
  /** 프로파일 코드별 생성 포인트(행 생략 제외) */
  byProfile: Uint32Array;
}

export class ModeBGenerator {
  private readonly profiles: Uint8Array[];
  private readonly states: Float64Array[];

  constructor(
    readonly devices: readonly ModeBDevice[],
    mix: ProfileMix,
    private readonly seed: number,
  ) {
    this.profiles = devices.map((d) => Uint8Array.from(d.tagIds, (id) => profileFor(mix, seed, id)));
    this.states = devices.map((d, i) =>
      Float64Array.from(d.tagIds, (id, j) => initialState(this.profiles[i]?.[j] ?? 0, seed, id)),
    );
  }

  get tagCount(): number {
    return this.devices.reduce((n, d) => n + d.tagIds.length, 0);
  }

  /** 시점 k(격자 번호) · 시각 ts(epoch ms) 하나 — 설비마다 엔트리 1 · s = k(설비 안에서 시점마다 증가) */
  step(k: number, ts: number): GeneratedStep {
    const byProfile = new Uint32Array(SIGNAL_PROFILES.length);
    const entries: GeneratedEntry[] = [];
    let points = 0;
    let dropped = 0;
    this.devices.forEach((d, i) => {
      const profiles = this.profiles[i] as Uint8Array;
      const state = this.states[i] as Float64Array;
      const tg: number[] = [];
      const va: number[] = [];
      d.tagIds.forEach((tagId, j) => {
        const code = profiles[j] ?? 0;
        const v = valueAt(code, this.seed, tagId, k, state, j);
        if (Number.isNaN(v)) {
          dropped += 1;
          return;
        }
        byProfile[code] = (byProfile[code] ?? 0) + 1;
        tg.push(tagId);
        va.push(v);
      });
      if (tg.length === 0) return; // 설비 전 태그가 결측 — 빈 엔트리를 내지 않는다
      const payload = encodeEntry({
        d: d.deviceId,
        s: k,
        t0: ts,
        tg,
        dt: new Array<number>(tg.length).fill(0),
        va,
        q: new Array<number>(tg.length).fill(QUALITY.SIMULATED),
      });
      entries.push({ payload, points: tg.length });
      points += tg.length;
    });
    return { entries, points, dropped, byProfile };
  }
}

/**
 * 해독 불가 섞기 — 발행하는 정상 엔트리 N개마다 하나를 끼운다(정상 엔트리를 대체하지 않는다 · 생성 수에 들지 않는다).
 * 카운터는 실행 전체에 걸쳐 이어진다 — 묶음 경계와 무관하게 N 간격이 유지된다.
 */
export class UndecodableMixer {
  private sinceLast = 0;
  injected = 0;

  constructor(private readonly every: number) {}

  mix(payloads: readonly Buffer[]): Buffer[] {
    if (this.every <= 0) return [...payloads];
    const out: Buffer[] = [];
    for (const p of payloads) {
      out.push(p);
      this.sinceLast += 1;
      if (this.sinceLast >= this.every) {
        out.push(UNDECODABLE_PAYLOAD);
        this.sinceLast = 0;
        this.injected += 1;
      }
    }
    return out;
  }
}
