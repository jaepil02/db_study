import { decodeEntry, StreamEntryV1 } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import { profileFor } from '../src/modules/datagen/signal/assignment';
import { PROFILE_CODE } from '../src/modules/datagen/signal/profiles';
import { generateWindow, tagIdOf, type WindowResult } from '../src/modules/datagen/signal/window';

const TAGS = 20;
const DEVICES = 6;
const SEED = 42;

function profilesFor(first: number, count: number, mix: 'all' | 'mixed') {
  const p = new Uint8Array(count * TAGS);
  for (let i = 0; i < p.length; i++)
    p[i] = profileFor(mix, SEED, tagIdOf(first + Math.floor(i / TAGS), i % TAGS, TAGS));
  return p;
}

/** 설비를 chunkSize씩 묶고 시점을 windows 크기들로 나눠 생성한 뒤 행 집합을 정렬해 돌려준다 */
function rows(chunkSize: number, windows: number[], mix: 'all' | 'mixed' = 'all'): string[] {
  const out: string[] = [];
  for (let first = 1; first <= DEVICES; first += chunkSize) {
    const count = Math.min(chunkSize, DEVICES - first + 1);
    let state: Float64Array | null = null;
    let k = 0;
    for (const steps of windows) {
      const r: WindowResult = generateWindow({
        seed: SEED,
        firstDevice: first,
        deviceCount: count,
        tagsPerDevice: TAGS,
        profiles: profilesFor(first, count, mix),
        k0: k,
        steps,
        startMs: 1_790_000_000_000,
        periodMs: 1000,
        state,
      });
      state = r.state;
      k += steps;
      for (let i = 0; i < r.entries; i++) {
        const e = StreamEntryV1.parse(decodeEntry(r.payload.subarray(r.offsets[i], r.offsets[i + 1])));
        e.tg.forEach((tag, j) => {
          out.push(`${e.d}|${e.t0 + (e.dt[j] ?? 0)}|${tag}|${e.va[j]}|${e.q[j]}`);
        });
      }
    }
  }
  return out.sort();
}

describe('창 생성 — 결정성 · 계약 · 표지', () => {
  it('설비 분할 · 시점 창 분할과 무관하게 같은 행 집합(REQ-GEN-03 — 워커 수 무관의 근거)', () => {
    const a = rows(6, [30]);
    expect(rows(1, [30])).toEqual(a);
    expect(rows(4, [7, 3, 20])).toEqual(a);
    expect(rows(2, [1, 1, 28])).toEqual(a);
  });

  it('모든 엔트리가 계약 v1을 통과하고 품질은 전부 SIMULATED(9)', () => {
    const r = rows(3, [10]);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((x) => x.endsWith('|9'))).toBe(true);
  });

  it('DROPOUT은 행을 생략한다 — BAD를 달지 않는다', () => {
    const all = rows(6, [200]);
    const expected = DEVICES * TAGS * 200;
    const dropoutTags = Array.from({ length: DEVICES * TAGS }, (_, i) =>
      profileFor('all', SEED, tagIdOf(1 + Math.floor(i / TAGS), i % TAGS, TAGS)),
    ).filter((c) => c === PROFILE_CODE.DROPOUT).length;
    expect(dropoutTags).toBeGreaterThan(0);
    expect(all.length).toBeLessThan(expected);
    expect(all.length).toBeGreaterThan(expected - dropoutTags * 200);
  });

  it('혼합 구성 — STEP · SINE · RANDOM_WALK만 나온다', () => {
    const codes = new Set(Array.from({ length: 2000 }, (_, i) => profileFor('mixed', SEED, i + 1)));
    expect(codes).toEqual(new Set([PROFILE_CODE.STEP, PROFILE_CODE.SINE, PROFILE_CODE.RANDOM_WALK]));
  });
});
