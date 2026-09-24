// 생성기 서비스 — 프로세스당 piscina 풀 하나(09_tech_stack/02 §워커 풀) · 창 분할 · 상태 이어받기 · 계측
import { resolve } from 'node:path';
import { CAPACITY_TIERS, type CapacityTier, SIGNAL_PROFILES } from '@db-study/shared';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import Piscina from 'piscina';
import { Counter, Gauge, Registry } from 'prom-client';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { type ProfileMix, profileFor } from './signal/assignment';
import { tagIdOf, type WindowResult, type WindowTask } from './signal/window';

export interface BenchOptions {
  tier: CapacityTier;
  mix: ProfileMix;
  seed: number;
  warmupMs: number;
  durationMs: number;
  /** 작업 하나가 맡는 연속 시점 수 */
  stepsPerTask: number;
  /** 설비 묶음 수 — 워커보다 넉넉해야 풀이 쉬지 않는다 */
  chunks: number;
}

export interface BenchResult {
  points: number;
  dropped: number;
  entries: number;
  bytes: number;
  elapsedMs: number;
  pointsPerSecond: number;
  bytesPerEntry: number;
  bytesPerPoint: number;
  workerUtilization: number;
  processCpuCores: number;
}

interface Chunk {
  firstDevice: number;
  deviceCount: number;
  profiles: Uint8Array;
  state: Float64Array | null;
  k: number;
}

@Injectable()
export class DatagenService implements OnModuleDestroy {
  readonly registry = new Registry();
  private readonly generated = new Counter({
    name: 'gen_points_generated_total',
    help: '생성 카운트 — 무손실 판정의 분모',
    labelNames: ['mode', 'profile'],
    registers: [this.registry],
  });
  private readonly dropout = new Counter({
    name: 'gen_points_dropout_total',
    help: 'DROPOUT이 생략한 행',
    labelNames: ['mode'],
    registers: [this.registry],
  });
  private readonly utilization = new Gauge({
    name: 'gen_worker_utilization',
    help: '생성기 워커 스레드 사용률 — 생성기 CPU',
    labelNames: ['mode'],
    registers: [this.registry],
  });
  readonly pool: Piscina;

  constructor(@Inject(APP_CONFIG) readonly cfg: AppConfig) {
    this.pool = new Piscina({
      filename: resolve(__dirname, 'worker.js'),
      minThreads: cfg.workerPoolSize,
      maxThreads: cfg.workerPoolSize,
      idleTimeout: 60_000,
    });
  }

  async onModuleDestroy() {
    await this.pool.destroy();
  }

  /** 티어 · 구성에서 설비 묶음을 만든다 — 태그 배정은 시드로 정해져 묶음 경계와 무관하다 */
  private chunksFor(tier: CapacityTier, mix: ProfileMix, seed: number, count: number): Chunk[] {
    const t = CAPACITY_TIERS[tier];
    const per = Math.ceil(t.devices / count);
    const out: Chunk[] = [];
    for (let first = 1; first <= t.devices; first += per) {
      const deviceCount = Math.min(per, t.devices - first + 1);
      const profiles = new Uint8Array(deviceCount * t.tagsPerDevice);
      for (let i = 0; i < profiles.length; i++) {
        const dev = first + Math.floor(i / t.tagsPerDevice);
        profiles[i] = profileFor(mix, seed, tagIdOf(dev, i % t.tagsPerDevice, t.tagsPerDevice));
      }
      out.push({ firstDevice: first, deviceCount, profiles, state: null, k: 0 });
    }
    return out;
  }

  private runChunk(c: Chunk, o: BenchOptions): Promise<WindowResult> {
    const t = CAPACITY_TIERS[o.tier];
    const task: WindowTask = {
      seed: o.seed,
      firstDevice: c.firstDevice,
      deviceCount: c.deviceCount,
      tagsPerDevice: t.tagsPerDevice,
      profiles: c.profiles,
      k0: c.k,
      steps: o.stepsPerTask,
      startMs: 0,
      periodMs: 1000 / t.hz,
      state: c.state,
    };
    const transferList = c.state ? [c.state.buffer as ArrayBuffer] : [];
    c.state = null; // 소유권이 워커로 간다
    return this.pool.run(task, { transferList }) as Promise<WindowResult>;
  }

  /**
   * 생성기 단독 처리량(GEN-09 · EXP-21) — 수집 경로 없이 생성 + 인코딩을 최대 속도로 돌린다.
   * 묶음마다 직전 창이 끝나야 다음 창을 넣는다(상태 의존) — 묶음 수가 워커보다 많아 풀은 쉬지 않는다.
   */
  async runBench(o: BenchOptions): Promise<BenchResult> {
    const chunks = this.chunksFor(o.tier, o.mix, o.seed, o.chunks);
    const mode = 'bench';
    let measuring = false;
    let stop = false;
    const acc = { points: 0, dropped: 0, entries: 0, bytes: 0, busyMs: 0 };
    const loop = async (c: Chunk) => {
      while (!stop) {
        const r = await this.runChunk(c, o);
        c.state = r.state;
        c.k += o.stepsPerTask;
        if (measuring && !stop) {
          acc.points += r.points;
          acc.dropped += r.dropped;
          acc.entries += r.entries;
          acc.bytes += r.payload.byteLength;
          acc.busyMs += r.busyMs ?? 0;
          this.generated.inc({ mode, profile: o.mix }, r.points);
          this.dropout.inc({ mode }, r.dropped);
        }
      }
    };
    const loops = chunks.map((c) => loop(c));
    await new Promise((r) => setTimeout(r, o.warmupMs));
    measuring = true;
    const cpu0 = process.cpuUsage();
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, o.durationMs));
    const elapsedMs = performance.now() - t0;
    const cpu = process.cpuUsage(cpu0);
    stop = true;
    // 워커 사용률 = 창 안 작업 실행 시간 합 ÷ (경과 × 워커 수) — 생성기 CPU(gen_worker_utilization)
    const workerUtilization = acc.busyMs / (elapsedMs * this.cfg.workerPoolSize);
    this.utilization.set({ mode }, workerUtilization);
    await Promise.all(loops);
    const { busyMs: _busy, ...counts } = acc;
    return {
      ...counts,
      elapsedMs,
      pointsPerSecond: acc.points / (elapsedMs / 1000),
      bytesPerEntry: acc.entries ? acc.bytes / acc.entries : 0,
      bytesPerPoint: acc.points ? acc.bytes / acc.points : 0,
      workerUtilization,
      processCpuCores: (cpu.user + cpu.system) / 1000 / elapsedMs,
    };
  }

  /** 정해진 시점 수만 생성해 결과를 돌려준다 — 결정성 검증 · 엔트리 크기 실측용 */
  async generateSteps(
    o: Pick<BenchOptions, 'tier' | 'mix' | 'seed' | 'chunks' | 'stepsPerTask'>,
    totalSteps: number,
  ) {
    const chunks = this.chunksFor(o.tier, o.mix, o.seed, o.chunks);
    const results: WindowResult[] = [];
    await Promise.all(
      chunks.map(async (c) => {
        for (let done = 0; done < totalSteps; done += o.stepsPerTask) {
          const r = await this.runChunk(c, {
            ...o,
            stepsPerTask: Math.min(o.stepsPerTask, totalSteps - done),
          } as BenchOptions);
          c.state = r.state;
          c.k += Math.min(o.stepsPerTask, totalSteps - done);
          results.push(r);
        }
      }),
    );
    return results;
  }
}

export const KNOWN_MIXES = ['mixed', 'all', ...SIGNAL_PROFILES] as const;
