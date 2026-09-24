// 프로세스당 piscina 풀 하나 — 크기는 WORKER_POOL_SIZE(값 소유 04_architecture/03 · 워커 수 ≤ CPU 집합 크기)
import { resolve } from 'node:path';
import { Global, Inject, Injectable, Module, type OnApplicationShutdown } from '@nestjs/common';
import Piscina from 'piscina';
import { Gauge, Histogram } from 'prom-client';
import type { AppConfig } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { appRegistry, LATENCY_BUCKETS_SECONDS } from '../metrics/registry';

const taskDuration = new Histogram({
  name: 'worker_pool_task_duration_seconds',
  help: '워커 작업 시간(대기 제외) — 대기와 실행을 가른다',
  labelNames: ['pool'],
  buckets: LATENCY_BUCKETS_SECONDS,
  registers: [appRegistry],
});

@Injectable()
export class WorkerPool implements OnApplicationShutdown {
  readonly pool: Piscina;

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.pool = new Piscina({
      filename: resolve(__dirname, 'tasks.js'),
      minThreads: cfg.workerPoolSize,
      maxThreads: cfg.workerPoolSize,
      idleTimeout: 60_000,
    });
    const pool = this.pool;
    new Gauge({
      name: 'worker_pool_queue_length',
      help: 'piscina 워커 풀 대기열 길이 — 격리 작업이 워커를 기다리는 양',
      labelNames: ['pool'],
      registers: [appRegistry],
      collect() {
        this.set({ pool: 'main' }, pool.queueSize);
      },
    });
  }

  /** 작업 시간은 워커 안에서 잰 busyMs로 기록한다 — run 호출 구간은 대기열 대기를 포함한다 */
  async run<T extends { busyMs?: number }>(task: unknown, name?: 'decode' | 'gzip' | 'gunzip'): Promise<T> {
    const r = (await this.pool.run(task, name ? { name } : {})) as T;
    if (typeof r.busyMs === 'number') taskDuration.observe({ pool: 'main' }, r.busyMs / 1000);
    return r;
  }

  /** 연결 정리는 종료 훅 마지막 단계 — Ingest 드레인(beforeApplicationShutdown)이 끝난 뒤다 */
  async onApplicationShutdown() {
    await this.pool.destroy();
  }
}

@Global()
@Module({ providers: [WorkerPool], exports: [WorkerPool] })
export class WorkerPoolModule {}
