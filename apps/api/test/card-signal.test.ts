// 카드 라인 가상 PLC 값(D-16 결정 3) — 종류 → 프로파일 · 설비 운전 상태(결정적) · 상태 연동 · 템플릿 범위 · 레지스터 인코딩
// 정본 docs/06_pipeline/10_datagen_inject.md §모드 A 레지스터 갱신 · 신호 규칙 apps/api/src/modules/datagen/signal/card-signal.ts
import { DEVICE_STATE_CODE, TAG_KINDS } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import { seedLayout } from '../src/db/seed-plan';
import { decodeRaw, type RegisterDataType, type WordOrder } from '../src/modules/collector/decode';
import {
  cardSpecOf,
  cardValue,
  MODE_A_SEED,
  type ModeATag,
  makeTarget,
  PROFILE_NAMES,
  writeTick,
} from '../src/modules/datagen/mode-a/register-writer';
import { KIND_PROFILE } from '../src/modules/datagen/signal/assignment';
import {
  type CardSignalSpec,
  cardInitialState,
  cardValueAt,
  DEVICE_STATE_SLOT_MS,
  deviceStateAt,
} from '../src/modules/datagen/signal/card-signal';
import { PROFILE_CODE } from '../src/modules/datagen/signal/profiles';

const seed = MODE_A_SEED;
const { RUNNING, IDLE, STOPPED } = DEVICE_STATE_CODE;

/** 카드 라인 시드 태그 → 모드 A 태그(시드 순서대로 tag_id · device_id를 붙인다) */
const cardTags: ModeATag[] = seedLayout({ kind: 'card-line' }).lines.flatMap((l, li) =>
  l.devices.flatMap((d, di) =>
    d.tags.map((t, ti) => ({
      tagId: 1000 + li * 100 + di * 10 + ti,
      deviceId: 100 + li * 10 + di,
      tagCode: t.tagCode,
      address: t.address,
      dataType: t.dataType,
      wordOrder: t.wordOrder,
      scale: 1,
      offsetValue: 0,
      scanRateMs: t.scanRateMs,
      tagKind: t.tagKind,
      rangeMin: t.rangeMin,
      rangeMax: t.rangeMax,
    })),
  ),
);
const specOf = (code: string): CardSignalSpec => {
  const t = cardTags.find((x) => x.tagCode === code);
  const s = t ? cardSpecOf(t) : null;
  if (!s) throw new Error(`태그 없음 ${code}`);
  return s;
};

describe('종류 → 프로파일(KIND_PROFILE)', () => {
  it('8종 전부 · 지침서 매핑 그대로 · 상태 기계는 STEP 칸', () => {
    expect(Object.keys(KIND_PROFILE).sort()).toEqual([...TAG_KINDS].sort());
    expect(KIND_PROFILE).toEqual({
      TEMP: 'RANDOM_WALK',
      PRESSURE: 'SINE',
      SPEED: 'STEP',
      CURRENT: 'SINE',
      VIBRATION: 'SPIKE',
      COUNT: 'COUNTER',
      STATE: 'STEP',
      OTHER: 'RANDOM_WALK',
    });
  });

  it('종류가 있으면 종류 신호(계측 레이블 = KIND_PROFILE) · 없으면 GEN_PROFILE 구성 그대로', () => {
    const vib = cardTags.find((t) => t.tagCode === 'L1-MIL-VIB') as ModeATag;
    const t = makeTarget(Buffer.alloc(64), vib, 'SINE');
    expect(t.card?.kind).toBe('VIBRATION');
    expect(PROFILE_NAMES[t.profile]).toBe('SPIKE');
    const plain = makeTarget(Buffer.alloc(64), { ...vib, tagKind: null }, 'SINE');
    expect(plain.card).toBeNull();
    expect(plain.profile).toBe(PROFILE_CODE.SINE);
    expect(cardSpecOf({ ...vib, deviceId: undefined })).toBeNull(); // 설비를 모르면 종류 신호를 만들 수 없다
    expect(specOf('L1-EMB-DEFECTS').defect).toBe(true);
    expect(specOf('L1-EMB-INSERTED').defect).toBe(false);
  });
});

describe('설비 운전 상태 — 결정적 상태 기계', () => {
  it('같은 (시드 · 설비 · 시각)은 늘 같은 값 · 칸 안에서는 바뀌지 않는다 · 값은 0 · 1 · 2', () => {
    const t0 = 1_760_000_000_000;
    for (let d = 1; d <= 30; d++) {
      expect(deviceStateAt(seed, d, t0)).toBe(deviceStateAt(seed, d, t0));
      expect([STOPPED, IDLE, RUNNING]).toContain(deviceStateAt(seed, d, t0));
    }
    // 한 칸(40초) 안에서 바뀌는 횟수는 많아야 1(칸 경계를 한 번 지날 수 있다)
    const changes = Array.from({ length: 40 }, (_, i) => deviceStateAt(seed, 7, t0 + i * 1000)).filter(
      (v, i, a) => i > 0 && v !== a[i - 1],
    ).length;
    expect(changes).toBeLessThanOrEqual(1);
  });

  it('대부분 가동 · 가끔 대기 · 드물게 정지 — 30대 × 하루 칸 표본 비율', () => {
    const count: number[] = [0, 0, 0]; // 상태 코드 0 · 1 · 2
    const t0 = 1_760_000_000_000;
    const slots = Math.floor(86_400_000 / DEVICE_STATE_SLOT_MS);
    for (let d = 1; d <= 30; d++)
      for (let k = 0; k < slots; k++) {
        const s = deviceStateAt(seed, d, t0 + k * DEVICE_STATE_SLOT_MS);
        count[s] = (count[s] ?? 0) + 1;
      }
    const total = 30 * slots;
    expect((count[RUNNING] ?? 0) / total).toBeGreaterThan(0.82);
    expect((count[RUNNING] ?? 0) / total).toBeLessThan(0.9);
    expect((count[IDLE] ?? 0) / total).toBeGreaterThan(0.07);
    expect((count[STOPPED] ?? 0) / total).toBeGreaterThan(0.02);
    expect((count[STOPPED] ?? 0) / total).toBeLessThan(0.06);
  });

  it('설비마다 칸 경계가 다르다 — 30대가 한꺼번에 바뀌지 않는다', () => {
    const t0 = 1_760_000_000_000;
    const flips = new Set<number>();
    for (let d = 1; d <= 30; d++)
      for (let s = 0; s < DEVICE_STATE_SLOT_MS; s += 1000)
        if (deviceStateAt(seed, d, t0 + s) !== deviceStateAt(seed, d, t0 + s + 1000)) flips.add(s);
    expect(flips.size).toBeGreaterThan(3);
  });
});

/** 상태를 고정해 n 시점을 돌린 값 */
function run(spec: CardSignalSpec, deviceState: number, n: number, k0 = 1_000_000, state?: Float64Array) {
  const st = state ?? Float64Array.of(cardInitialState(spec, seed));
  return Array.from({ length: n }, (_, i) => cardValueAt(spec, seed, k0 + i, st, deviceState));
}

describe('상태 연동 — 가동이 아니면 속도 0 · 수량 멈춤 · 압력 · 전류 · 진동 0 근처 · 온도 천천히 하강', () => {
  it('속도 — 가동이면 범위 위쪽(65% 이상) · 대기 · 정지면 0', () => {
    const s = specOf('L1-PRT-SPEED');
    for (const v of run(s, RUNNING, 300)) {
      expect(v).toBeGreaterThanOrEqual(120 * 0.6);
      expect(v).toBeLessThanOrEqual(120);
    }
    expect(run(s, IDLE, 50).every((v) => v === 0)).toBe(true);
    expect(run(s, STOPPED, 50).every((v) => v === 0)).toBe(true);
  });

  it('수량 — 가동이면 늘고(단조 증가 · 정수) · 아니면 그대로 · 불량 계수는 훨씬 느리다', () => {
    const s = specOf('L1-EMB-INSERTED');
    const st = Float64Array.of(cardInitialState(s, seed));
    const up = run(s, RUNNING, 600, 1_000_000, st);
    expect(up.every((v, i) => Number.isInteger(v) && (i === 0 || v >= (up[i - 1] as number)))).toBe(true);
    expect((up.at(-1) as number) - (up[0] as number)).toBeGreaterThan(300); // 초당 0.8개 이상 × 600초
    const frozen = run(s, IDLE, 100, 1_000_600, st);
    expect(new Set(frozen).size).toBe(1);
    expect(frozen[0]).toBe(up.at(-1));
    const d = specOf('L1-EMB-DEFECTS');
    const dv = run(d, RUNNING, 600);
    expect((dv.at(-1) as number) - (dv[0] as number)).toBeLessThan(40);
  });

  it('압력 · 전류 · 진동 — 가동이면 범위 안에서 움직이고 · 아니면 하한(0) 근처(범위의 2% 안)', () => {
    for (const [code, max] of [
      ['L1-LAM-PRESS', 25],
      ['L1-PUN-CURRENT', 40],
      ['L1-MIL-VIB', 8],
    ] as const) {
      const s = specOf(code);
      const on = run(s, RUNNING, 500);
      expect(Math.min(...on)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...on)).toBeLessThanOrEqual(max);
      expect(Math.max(...on) - Math.min(...on)).toBeGreaterThan(0);
      const off = run(s, STOPPED, 200);
      expect(Math.min(...off)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...off)).toBeLessThan(max * 0.02);
    }
  });

  it('온도 — 정지하면 천천히 내려가고(1분에 범위의 15% 안) · 가동하면 설정점으로 돌아간다 · 늘 범위 안', () => {
    const s = specOf('L2-LAM-TOP_TEMP'); // 120~170 °C · 1초
    const st = Float64Array.of(cardInitialState(s, seed));
    const start = st[0] as number;
    const cool = run(s, STOPPED, 600, 2_000_000, st);
    const after1m = cool[59] as number;
    expect(after1m).toBeLessThan(start);
    expect(start - after1m).toBeLessThan(50 * 0.15);
    expect(cool.at(-1) as number).toBeLessThan(after1m); // 10분째도 계속 내려가는 중
    const heat = run(s, RUNNING, 900, 2_000_600, st);
    expect(heat.at(-1) as number).toBeGreaterThan(cool.at(-1) as number);
    for (const v of [...cool, ...heat]) {
      expect(v).toBeGreaterThanOrEqual(120);
      expect(v).toBeLessThanOrEqual(170);
    }
  });

  it('상태 태그 = 설비 운전 상태 코드 · 기타는 운전 상태와 무관하게 범위 안', () => {
    const st = specOf('L1-PRT-STATE');
    expect(run(st, IDLE, 3)).toEqual([IDLE, IDLE, IDLE]);
    const align = specOf('L1-COL-ALIGN');
    for (const v of [...run(align, RUNNING, 300), ...run(align, STOPPED, 300)]) {
      expect(v).toBeGreaterThanOrEqual(-0.5);
      expect(v).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('모드 A 쓰기 — 설비 상태를 먼저 정하고 형식대로 인코딩', () => {
  it('한 설비의 태그는 같은 시각의 같은 운전 상태를 따른다(STATE 값과 속도 · 수량이 맞는다)', () => {
    const dev = cardTags.filter((t) => t.tagCode?.startsWith('L1-PUN-'));
    const t0 = 1_760_000_000_000;
    for (let i = 0; i < 200; i++) {
      const now = t0 + i * 7_000;
      const state = cardValue(
        cardSpecOf(dev.find((t) => t.tagKind === 'STATE') as ModeATag) as CardSignalSpec,
        Math.floor(now / 1000),
        new Float64Array(1),
      );
      const speedTag = dev.find((t) => t.tagKind === 'SPEED') as ModeATag;
      const speed = cardValue(
        cardSpecOf(speedTag) as CardSignalSpec,
        Math.floor(now / 1000),
        new Float64Array(1),
      );
      expect(state === RUNNING ? speed > 0 : speed === 0).toBe(true);
    }
  });

  it('레지스터 — FLOAT32 · UINT32 · UINT16를 디코더 규칙으로 되읽으면 같은 값(누계 · 상태는 정수)', () => {
    const dev = cardTags.filter((t) => t.tagCode?.startsWith('L1-EMB-'));
    const area = Buffer.alloc(64);
    const targets = dev.map((t) => makeTarget(area, t, 'SINE'));
    const now = 1_760_000_123_000;
    const r = writeTick(targets, now);
    expect(r.dropped).toBe(0);
    expect(r.written.reduce((a, n) => a + n, 0)).toBe(dev.length);
    const words = Array.from({ length: 32 }, (_, i) => area.readUInt16BE(i * 2));
    for (const t of targets) {
      const v = decodeRaw(
        words,
        t.tag.address,
        t.tag.dataType as RegisterDataType,
        (t.tag.wordOrder ?? 'ABCD') as WordOrder,
      );
      if (t.tag.dataType === 'FLOAT32') {
        expect(v).toBeGreaterThanOrEqual((t.tag.rangeMin ?? 0) - 1e-3);
        expect(v).toBeLessThanOrEqual((t.tag.rangeMax ?? Number.POSITIVE_INFINITY) + 1e-3);
      } else expect(Number.isInteger(v)).toBe(true);
      if (t.card?.kind === 'STATE') expect([STOPPED, IDLE, RUNNING]).toContain(v);
      if (t.card?.kind === 'COUNT') expect(v).toBe(t.state[0]);
    }
  });

  it('껐다 켜도 상태를 이어 쓴다 — 같은 state를 넘기면 누계가 처음으로 돌아가지 않는다', () => {
    const tag = cardTags.find((t) => t.tagCode === 'L1-PAC-PACKED') as ModeATag;
    const a = makeTarget(Buffer.alloc(64), tag, 'SINE');
    for (let k = 0; k < 120; k++) writeTick([a], 1_760_000_000_000 + k * 1000);
    const before = a.state[0] as number;
    const b = makeTarget(Buffer.alloc(64), tag, 'SINE', MODE_A_SEED, a.state);
    expect(b.lastK).toBe(-1); // 다시 켤 때 따라 잡지 않는다
    writeTick([b], 1_760_009_000_000);
    expect(b.state[0] as number).toBeGreaterThanOrEqual(before);
  });
});
