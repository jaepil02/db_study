import { describe, expect, it } from 'vitest';
import { decodeFloat32Abcd, toEng } from '../src/modules/collector/decode';
import {
  engToRaw,
  MODE_A_SEED,
  type ModeATarget,
  modeAValue,
  writeTick,
} from '../src/modules/datagen/mode-a/register-writer';
import { PROFILE_CODE, valueAt } from '../src/modules/datagen/signal/profiles';

const tag = { tagId: 7, address: 3, scale: 0.1, offsetValue: 5, scanRateMs: 1000 };

describe('GEN-05 모드 A 레지스터 갱신', () => {
  it('SINE · 시드 42 — S1 프로파일과 같은 값', () => {
    const k = 1_757_400_000;
    expect(modeAValue(7, k)).toBe(valueAt(PROFILE_CODE.SINE, MODE_A_SEED, 7, k, new Float64Array(1), 0));
  });

  it('k = floor(now / scan_rate_ms) — 같은 k는 다시 쓰지 않는다 · 새 k면 쓴다', () => {
    const holding = Buffer.alloc(16);
    const t: ModeATarget = { holding, tag, lastK: -1 };
    expect(writeTick([t], 5_000)).toBe(1);
    expect(writeTick([t], 5_999)).toBe(0);
    expect(writeTick([t], 6_000)).toBe(1);
    expect(t.lastK).toBe(6);
  });

  it('FLOAT32 ABCD로 address에 2워드 — 디코딩 · 공학 단위 변환이 신호 값으로 돌아온다', () => {
    const holding = Buffer.alloc(16);
    writeTick([{ holding, tag, lastK: -1 }], 42_000);
    const raw = decodeFloat32Abcd(holding.readUInt16BE(6), holding.readUInt16BE(8));
    const eng = modeAValue(7, 42);
    expect(raw).toBe(Math.fround(engToRaw(eng, tag.scale, tag.offsetValue)));
    expect(toEng(raw, tag.scale, tag.offsetValue)).toBeCloseTo(eng, 3);
    expect(holding.readUInt16BE(0)).toBe(0); // 다른 주소는 건드리지 않는다
    expect(holding.readUInt16BE(10)).toBe(0);
  });
});
