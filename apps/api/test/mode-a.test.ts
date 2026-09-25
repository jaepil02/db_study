import { describe, expect, it } from 'vitest';
import {
  decodeFloat32Abcd,
  decodeRaw,
  type RegisterDataType,
  toEng,
  type WordOrder,
} from '../src/modules/collector/decode';
import {
  engToRaw,
  MODE_A_SEED,
  makeTarget,
  modeAValue,
  writeTick,
} from '../src/modules/datagen/mode-a/register-writer';
import { profileFor } from '../src/modules/datagen/signal/assignment';
import { PROFILE_CODE, valueAt } from '../src/modules/datagen/signal/profiles';

const tag = {
  tagId: 7,
  address: 3,
  dataType: 'FLOAT32',
  wordOrder: 'ABCD',
  scale: 0.1,
  offsetValue: 5,
  scanRateMs: 1000,
};

describe('GEN-05 모드 A 레지스터 갱신', () => {
  it('SINE · 시드 42 — S1 프로파일과 같은 값', () => {
    const k = 1_757_400_000;
    expect(modeAValue(7, k)).toBe(valueAt(PROFILE_CODE.SINE, MODE_A_SEED, 7, k, new Float64Array(1), 0));
  });

  it('k = floor(now / scan_rate_ms) — 같은 k는 다시 쓰지 않는다 · 새 k면 쓴다', () => {
    const holding = Buffer.alloc(16);
    const t = makeTarget(holding, tag, 'SINE');
    expect(writeTick([t], 5_000).written[0]).toBe(1);
    expect(writeTick([t], 5_999).written[0]).toBe(0);
    expect(writeTick([t], 6_000).written[0]).toBe(1);
    expect(t.lastK).toBe(6);
  });

  it('FLOAT32 ABCD로 address에 2워드 — 디코딩 · 공학 단위 변환이 신호 값으로 돌아온다', () => {
    const holding = Buffer.alloc(16);
    writeTick([makeTarget(holding, tag, 'SINE')], 42_000);
    const raw = decodeFloat32Abcd(holding.readUInt16BE(6), holding.readUInt16BE(8));
    const eng = modeAValue(7, 42);
    expect(raw).toBe(Math.fround(engToRaw(eng, tag.scale, tag.offsetValue)));
    expect(toEng(raw, tag.scale, tag.offsetValue)).toBeCloseTo(eng, 3);
    expect(holding.readUInt16BE(0)).toBe(0); // 다른 주소는 건드리지 않는다
    expect(holding.readUInt16BE(10)).toBe(0);
  });
});

describe('GEN-05 S3 — 프로파일 배정 · 타입별 인코딩 · FC04 · DROPOUT', () => {
  it('GEN_PROFILE 구성으로 태그별 프로파일 — S1 assignment와 같은 배정(시드 42)', () => {
    const holding = Buffer.alloc(16);
    for (let id = 1; id <= 50; id++)
      expect(makeTarget(holding, { ...tag, tagId: id }, 'mixed').profile).toBe(
        profileFor('mixed', MODE_A_SEED, id),
      );
    expect(makeTarget(holding, tag, 'SPIKE').profile).toBe(PROFILE_CODE.SPIKE);
  });

  it('data_type · word_order로 인코딩 — Collector 디코딩으로 되돌아온다(FLOAT64 DCBA · INT16 · UINT32 CDAB)', () => {
    const cases = [
      { dataType: 'FLOAT64', wordOrder: 'DCBA', scale: 1, offsetValue: 0 },
      { dataType: 'INT16', wordOrder: null, scale: 0.1, offsetValue: 0 },
      { dataType: 'UINT32', wordOrder: 'CDAB', scale: 0.01, offsetValue: 0 },
    ];
    for (const c of cases) {
      const t = { ...tag, ...c, address: 0 };
      const area = Buffer.alloc(8);
      const target = makeTarget(area, t, 'SINE');
      writeTick([target], 77_000);
      const words = [0, 1, 2, 3].map((i) => area.readUInt16BE(i * 2));
      const raw = decodeRaw(words, 0, c.dataType as RegisterDataType, (c.wordOrder ?? 'ABCD') as WordOrder);
      const eng = modeAValue(t.tagId, 77, PROFILE_CODE.SINE);
      // 정수 타입은 raw 반올림 — 오차는 scale 절반 이하
      expect(Math.abs(toEng(raw, t.scale, t.offsetValue) - eng)).toBeLessThanOrEqual(t.scale / 2 + 1e-9);
    }
  });

  it('DROPOUT 결측은 쓰지 않는다(레지스터는 직전 값) · 따로 센다', () => {
    const area = Buffer.alloc(8);
    const target = makeTarget(area, { ...tag, address: 0, tagId: 11 }, 'DROPOUT');
    let written = 0;
    let dropped = 0;
    for (let k = 0; k < 300; k++) {
      const r = writeTick([target], k * 1000);
      written += r.written[PROFILE_CODE.DROPOUT] ?? 0;
      dropped += r.dropped;
    }
    expect(dropped).toBeGreaterThan(0);
    expect(written + dropped).toBe(300);
  });

  it('상태형(RANDOM_WALK)은 건너뛴 시점을 따라 잡는다 — 틱이 밀려도 같은 k에 같은 값', () => {
    const a = makeTarget(Buffer.alloc(8), { ...tag, address: 0 }, 'RANDOM_WALK');
    const b = makeTarget(Buffer.alloc(8), { ...tag, address: 0 }, 'RANDOM_WALK');
    for (let k = 100; k <= 110; k++) writeTick([a], k * 1000);
    writeTick([b], 100_000);
    writeTick([b], 110_000); // 101~109를 건너뛴 틱
    expect(b.area.equals(a.area)).toBe(true);
    expect(b.state[0]).toBe(a.state[0]);
  });
});
