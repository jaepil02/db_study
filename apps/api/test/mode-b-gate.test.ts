// 모드 B(GEN-06) — 적체 단계 판정 · 위험 중단 · 주의 임계 재개 · 해독 불가 섞기 · 엔트리 계약(06_pipeline/10 §모드 B 적체 검사)
import { decodeEntry, QUALITY, StreamEntryV1 } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import type { GroupBacklog } from '../src/common/redis/durable-key-client';
import { STREAM_MAXLEN } from '../src/config/app-config';
import {
  BackpressureGate,
  bandStage,
  STAGE,
  thresholdsFor,
} from '../src/modules/datagen/mode-b/backpressure-gate';
import {
  ModeBGenerator,
  UNDECODABLE_PAYLOAD,
  UndecodableMixer,
} from '../src/modules/datagen/mode-b/mode-b-generator';
import {
  assertTierShape,
  groupTags,
  parseModeBArgs,
  stepsPerSecond,
} from '../src/modules/datagen/mode-b/mode-b-options';
import {
  ModeBRunner,
  type RunnerClock,
  type StreamPublisher,
} from '../src/modules/datagen/mode-b/mode-b-runner';

const bl = (lag: number | null, pending = 0): GroupBacklog => ({ lag, pending });

describe('임계 — MAXLEN × 10 · 50 · 90%(04_architecture/06 §프로파일별 임계)', () => {
  it('세 프로파일 표와 같다', () => {
    expect(thresholdsFor(STREAM_MAXLEN.load)).toEqual({ caution: 20_000, warning: 100_000, danger: 180_000 });
    expect(thresholdsFor(STREAM_MAXLEN.dev)).toEqual({ caution: 5_000, warning: 25_000, danger: 45_000 });
    expect(thresholdsFor(STREAM_MAXLEN.mid)).toEqual({ caution: 15_000, warning: 75_000, danger: 135_000 });
  });

  it('주의 < 경고 < 위험 < MAXLEN이 성립하지 않으면 거절', () => {
    expect(() => thresholdsFor(5)).toThrow(/임계 모순/);
  });

  it('대역 — 정상 < 주의 ≤ … < 경고 ≤ … ≤ 위험 임계 < 위험', () => {
    const t = thresholdsFor(STREAM_MAXLEN.dev);
    expect(bandStage(4_999, t)).toBe(STAGE.NORMAL);
    expect(bandStage(5_000, t)).toBe(STAGE.CAUTION);
    expect(bandStage(25_000, t)).toBe(STAGE.WARNING);
    expect(bandStage(45_000, t)).toBe(STAGE.WARNING); // 위험은 "초과"
    expect(bandStage(45_001, t)).toBe(STAGE.DANGER);
  });
});

describe('단계 판정 · 재개', () => {
  it('판정량 = lag + pending(XLEN이 아니다)', () => {
    const g = new BackpressureGate(thresholdsFor(STREAM_MAXLEN.dev));
    expect(g.observe(bl(3_000, 2_000))).toBe(STAGE.CAUTION);
  });

  it('위험은 주의 임계 아래로 와야 풀린다 — 경고 · 주의 대역에서는 중단 유지', () => {
    const g = new BackpressureGate(thresholdsFor(STREAM_MAXLEN.dev));
    expect(g.observe(bl(50_000))).toBe(STAGE.DANGER);
    expect(g.halted).toBe(true);
    expect(g.observe(bl(30_000))).toBe(STAGE.DANGER);
    expect(g.observe(bl(5_000))).toBe(STAGE.DANGER);
    expect(g.observe(bl(4_999))).toBe(STAGE.NORMAL);
    expect(g.halted).toBe(false);
  });

  it('lag가 비거나 응답이 없으면 직전 단계 유지(ADR-21)', () => {
    const g = new BackpressureGate(thresholdsFor(STREAM_MAXLEN.dev));
    g.observe(bl(30_000));
    expect(g.observe(bl(null, 0))).toBe(STAGE.WARNING);
    expect(g.observe(null)).toBe(STAGE.WARNING);
  });

  it('XADD 실패는 위험으로 간주', () => {
    const g = new BackpressureGate(thresholdsFor(STREAM_MAXLEN.dev));
    expect(g.xaddFailed()).toBe(STAGE.DANGER);
  });
});

describe('엔트리 생성 — Collector와 같은 계약 · 품질 9 · DROPOUT 행 생략', () => {
  const devices = [
    { deviceId: 1, tagIds: [1, 2, 3] },
    { deviceId: 2, tagIds: [4, 5, 6] },
  ];

  it('설비 × 시점 엔트리 · t0 = ts · dt 0 · s = k · 스키마 통과', () => {
    const gen = new ModeBGenerator(devices, 'SINE', 42);
    const r = gen.step(1_757_400_000, 1_757_400_000_000);
    expect(r.entries).toHaveLength(2);
    const e = decodeEntry(r.entries[1]?.payload as Buffer);
    expect(StreamEntryV1.safeParse(e).success).toBe(true);
    expect(e).toMatchObject({ d: 2, s: 1_757_400_000, t0: 1_757_400_000_000, tg: [4, 5, 6], dt: [0, 0, 0] });
    expect(e.q.every((q) => q === QUALITY.SIMULATED)).toBe(true);
    expect(r.points).toBe(6);
  });

  it('DROPOUT은 행을 생략하고 따로 센다 · 생성 + 생략 = 태그 × 시점', () => {
    const gen = new ModeBGenerator(devices, 'DROPOUT', 42);
    let points = 0;
    let dropped = 0;
    for (let k = 0; k < 500; k++) {
      const r = gen.step(k, k * 1000);
      points += r.points;
      dropped += r.dropped;
      for (const e of r.entries) expect(decodeEntry(e.payload).tg.length).toBe(e.points);
    }
    expect(dropped).toBeGreaterThan(0);
    expect(points + dropped).toBe(6 * 500);
  });

  it('같은 시드면 같은 페이로드(REQ-GEN-03)', () => {
    const a = new ModeBGenerator(devices, 'mixed', 7).step(10, 10_000);
    const b = new ModeBGenerator(devices, 'mixed', 7).step(10, 10_000);
    expect(a.entries.map((e) => e.payload.toString('hex'))).toEqual(
      b.entries.map((e) => e.payload.toString('hex')),
    );
  });
});

describe('해독 불가 섞기(EXP-19)', () => {
  it('N 엔트리마다 하나 · 묶음 경계를 넘어 간격 유지 · 0이면 없음', () => {
    const m = new UndecodableMixer(3);
    const p = (n: number) => Array.from({ length: n }, (_, i) => Buffer.from([i]));
    const a = m.mix(p(4));
    const b = m.mix(p(5));
    const junkAt = (xs: Buffer[]) => xs.flatMap((x, i) => (x === UNDECODABLE_PAYLOAD ? [i] : []));
    expect(junkAt(a)).toEqual([3]);
    expect(junkAt(b)).toEqual([2, 6]);
    expect(m.injected).toBe(3);
    expect(new UndecodableMixer(0).mix(p(10))).toHaveLength(10);
  });

  it('소비자 unpack이 던지는 바이트다', () => {
    expect(() => decodeEntry(UNDECODABLE_PAYLOAD)).toThrow();
  });
});

/** 가짜 Stream — 적체는 스크립트가 정한다 · 실패 주입 가능 */
class FakeStream implements StreamPublisher {
  published: Buffer[] = [];
  backlog: GroupBacklog | null = bl(0);
  failNext = 0;
  xinfoOnly = 0;
  async xaddBatchWithBacklog(_s: string, payloads: readonly Buffer[]) {
    const results = payloads.map((payload): string | Error => {
      if (this.failNext > 0) {
        this.failNext -= 1;
        return new Error('OOM command not allowed');
      }
      this.published.push(payload);
      return `${this.published.length}-0`;
    });
    return { results, backlog: this.backlog };
  }
  async groupBacklog() {
    this.xinfoOnly += 1;
    return this.backlog;
  }
}

const fakeClock = (): RunnerClock => {
  let t = 1_757_400_000_500;
  return {
    nowMs: () => t,
    monoMs: () => t,
    sleepUntil: async (at) => {
      t = Math.max(t, at);
    },
  };
};

describe('발행 루프 — 위험이면 중단 · 적체 확인만 · 주의 아래서 재개 · 생성 시계는 멈추지 않는다', () => {
  const devices = [
    { deviceId: 1, tagIds: [1, 2] },
    { deviceId: 2, tagIds: [3, 4] },
  ];

  it('중단 · 재개 계수와 ts', async () => {
    const s = new FakeStream();
    const gate = new BackpressureGate(thresholdsFor(STREAM_MAXLEN.dev));
    const r = new ModeBRunner(
      new ModeBGenerator(devices, 'SINE', 42),
      s,
      { stepsPerSecond: 2, durationSeconds: 1, maxlen: STREAM_MAXLEN.dev, undecodableEvery: 0 },
      gate,
      fakeClock(),
    );
    // 틱 1: 정상 발행 → 결과 적체 50,000(위험)
    s.backlog = bl(50_000);
    await r.tick(1_000_000);
    expect(s.published).toHaveLength(4); // 설비 2 × 시점 2
    expect(gate.halted).toBe(true);
    // 틱 2: 위험 — 발행하지 않고 XINFO만 · 적체 10,000(주의 이상)이라 유지
    s.backlog = bl(10_000);
    await r.tick(1_001_000);
    expect(s.published).toHaveLength(4);
    expect(s.xinfoOnly).toBe(1);
    expect(gate.halted).toBe(true);
    // 틱 3: 여전히 중단 · 적체 4,000 → 다음 묶음부터 재개
    s.backlog = bl(4_000);
    await r.tick(1_002_000);
    expect(s.published).toHaveLength(4);
    expect(gate.halted).toBe(false);
    // 틱 4: 재개 — ts는 현재 격자(중단 구간을 몰아 발행하지 않는다)
    await r.tick(1_003_000);
    expect(s.published).toHaveLength(8);
    expect(s.published.slice(4).map((p) => decodeEntry(p).t0)).toEqual([
      1_002_500, 1_002_500, 1_003_000, 1_003_000,
    ]);
    const sum = r.summary(1000);
    expect(sum).toMatchObject({
      generatedEntries: 16,
      generatedPoints: 32,
      publishedEntries: 8,
      haltedEntries: 8,
      haltedPoints: 16,
      maxBacklog: 50_000,
    });
    expect(sum.generatedEntries).toBe(sum.publishedEntries + sum.haltedEntries);
  });

  it('XADD 실패 — 실패 엔트리를 중단 수에 더하고 위험으로 간다', async () => {
    const s = new FakeStream();
    s.failNext = 1;
    const gate = new BackpressureGate(thresholdsFor(STREAM_MAXLEN.dev));
    const r = new ModeBRunner(
      new ModeBGenerator(devices, 'SINE', 42),
      s,
      { stepsPerSecond: 1, durationSeconds: 1, maxlen: STREAM_MAXLEN.dev, undecodableEvery: 0 },
      gate,
      fakeClock(),
    );
    await r.tick(2_000_000);
    const sum = r.summary(1000);
    expect(sum).toMatchObject({ publishedEntries: 1, haltedEntries: 1, haltedPoints: 2, xaddFailures: 1 });
    expect(gate.halted).toBe(true);
  });

  it('해독 불가 섞기 — 발행한 것만 센다 · 생성 · 발행 수에 들지 않는다', async () => {
    const s = new FakeStream();
    const r = new ModeBRunner(
      new ModeBGenerator(devices, 'SINE', 42),
      s,
      { stepsPerSecond: 1, durationSeconds: 3, maxlen: STREAM_MAXLEN.dev, undecodableEvery: 2 },
      new BackpressureGate(thresholdsFor(STREAM_MAXLEN.dev)),
      fakeClock(),
    );
    const sum = await r.run();
    expect(sum.ticks).toBe(3);
    expect(sum.publishedEntries).toBe(6);
    expect(sum.undecodableInjected).toBe(3);
    expect(s.published.filter((p) => p === UNDECODABLE_PAYLOAD)).toHaveLength(3);
    expect(s.published).toHaveLength(9);
  });
});

describe('실행 인자 · 태그 집합', () => {
  it('인자 — 기본값 · 범위 밖 거부', () => {
    expect(parseModeBArgs(['--tier', 'M'])).toEqual({
      tier: 'M',
      mix: 'mixed',
      seed: 42,
      durationSeconds: 60,
      pps: null,
      undecodableEvery: 0,
    });
    expect(
      parseModeBArgs(['--tier', 'S', '--undecodable-every', '100', '--mix', 'SPIKE']).undecodableEvery,
    ).toBe(100);
    expect(() => parseModeBArgs(['--tier', 'X'])).toThrow();
    expect(() => parseModeBArgs(['--tier', 'S', '--duration', '0'])).toThrow();
    expect(() => parseModeBArgs(['--tier', 'S', '--mix', 'NOPE'])).toThrow();
  });

  it('tag_master 행 → 설비별 태그 · 티어 모양 대조', () => {
    const rows = [
      { device_id: '2', tag_id: '4' },
      { device_id: '1', tag_id: '2' },
      { device_id: '1', tag_id: '1' },
      { device_id: '2', tag_id: '3' },
    ];
    expect(groupTags(rows)).toEqual([
      { deviceId: 1, tagIds: [1, 2] },
      { deviceId: 2, tagIds: [3, 4] },
    ]);
    const s = Array.from({ length: 5 }, (_, d) => ({
      deviceId: d + 1,
      tagIds: Array.from({ length: 50 }, (_, i) => d * 50 + i + 1),
    }));
    expect(() => assertTierShape(s, 'S')).not.toThrow();
    expect(() => assertTierShape(s, 'M')).toThrow(/티어 M/);
  });

  it('초당 시점 = pps ÷ 태그 — 티어 기본은 hz와 같다 · 1,000의 약수 정수가 아니면 거부', () => {
    expect(stepsPerSecond(250, 250)).toBe(1); // S
    expect(stepsPerSecond(100_000, 10_000)).toBe(10); // M+
    expect(() => stepsPerSecond(300, 250)).toThrow();
    expect(() => stepsPerSecond(750, 250)).toThrow(); // 3은 1,000의 약수가 아니다
  });
});
