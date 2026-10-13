// 라이브 실행 발행 게이트 · 측정 규칙 — 적체 단계 판정 · 위험 중단 · 주의 임계 재개(06_pipeline/10 §라이브 실행)
// 측정 규칙(워밍업 1 + 3회 · 중간값 · 3회 모두 같은 승자) — 웨이브 2 비교 실행이 다시 쓴다(modules/runs/measure.ts)
import { describe, expect, it } from 'vitest';
import type { GroupBacklog } from '../src/common/redis/durable-key-client';
import { STREAM_MAXLEN } from '../src/config/app-config';
import { BackpressureGate, bandStage, STAGE, thresholdsFor } from '../src/modules/runs/backpressure-gate';
import {
  MEASURE_REPS,
  MEASURE_WARMUP,
  measureReps,
  median,
  speedRatio,
  unanimousWinner,
} from '../src/modules/runs/measure';

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

describe('측정 규칙 — 워밍업 1 + 3회 · 중간값 · 승패는 3회 모두 같을 때만', () => {
  it('중간값 — 홀수는 가운데 · 짝수는 가운데 둘의 평균 · 빈 배열은 null', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('워밍업 1회는 버리고 3회만 싣는다 · 행 수는 마지막 회', async () => {
    let t = 0;
    const steps = [100, 10, 20, 30];
    let i = 0;
    const clock = { monoMs: () => t };
    const r = await measureReps(
      async () => {
        t += steps[i] as number;
        i += 1;
        return i * 10;
      },
      { clock },
    );
    expect(MEASURE_WARMUP + MEASURE_REPS).toBe(4);
    expect(r.values).toEqual([10, 20, 30]);
    expect(r.rows).toBe(40);
  });

  it('중단 신호가 오면 다음 회 전에 멈춘다', async () => {
    let calls = 0;
    const stop = new Error('stop');
    await expect(
      measureReps(
        async () => {
          calls += 1;
          return 0;
        },
        { stopped: () => calls >= 2, onStop: () => stop },
      ),
    ).rejects.toBe(stop);
    expect(calls).toBe(2);
  });

  it('승자 — 3회 모두 같은 쪽이 빨라야 그 쪽 · 한 번이라도 뒤집히거나 같으면 승패 없음', () => {
    expect(unanimousWinner({ key: 'ch', values: [1, 2, 3] }, { key: 'pg', values: [5, 6, 7] })).toBe('ch');
    expect(unanimousWinner({ key: 'ch', values: [9, 9, 9] }, { key: 'pg', values: [5, 6, 7] })).toBe('pg');
    expect(unanimousWinner({ key: 'ch', values: [1, 9, 3] }, { key: 'pg', values: [5, 6, 7] })).toBeNull();
    expect(unanimousWinner({ key: 'ch', values: [5, 2, 3] }, { key: 'pg', values: [5, 6, 7] })).toBeNull();
    expect(unanimousWinner({ key: 'ch', values: [1, 2] }, { key: 'pg', values: [5, 6, 7] })).toBeNull();
    expect(unanimousWinner({ key: 'ch', values: [] }, { key: 'pg', values: [] })).toBeNull();
  });

  it('배수 — 느린 쪽 ÷ 빠른 쪽 · 없거나 0이면 null', () => {
    expect(speedRatio(2, 10)).toBe(5);
    expect(speedRatio(10, 2)).toBe(5);
    expect(speedRatio(3, 10)).toBe(3.33);
    expect(speedRatio(null, 10)).toBeNull();
    expect(speedRatio(0, 10)).toBeNull();
  });
});
