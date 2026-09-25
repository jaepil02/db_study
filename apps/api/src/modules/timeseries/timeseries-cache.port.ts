// SW-03 REDIS_QUERY_CACHE — TimeseriesCachePort(포트 · 구현 이름 정본 docs/04_architecture/02_module_boundaries.md)
// on: cache-aside · gzip 압축 결과(워커) · TTL 구간 분류 + 지터(래퍼 자동) / off: 항상 미스 — 매 요청 ClickHouse
// 캐시 계열이라 실패는 미스로 본다(degrade) — 요청을 실패시키지 않는다(REQ-TSQ-11).
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import type { BytesResult } from '../../common/workers/tasks';
import { WorkerPool } from '../../common/workers/worker-pool';

export const TIMESERIES_CACHE_PORT = Symbol('TimeseriesCachePort');

export interface TimeseriesCachePort {
  readonly implName: 'RedisTimeseriesCache' | 'NoopTimeseriesCache';
  /** failed — 캐시 호출 실패로 미스가 된 경우(degrade) */
  /** sha1 — 정규화 키의 해시(접두는 래퍼가 붙인다) */
  get(sha1: string): Promise<{ value: Buffer | null; failed: boolean }>;
  set(sha1: string, json: Buffer, ttlSeconds: number): Promise<void>;
}

export class RedisTimeseriesCache implements TimeseriesCachePort {
  readonly implName = 'RedisTimeseriesCache' as const;
  constructor(
    private readonly cache: CacheKeyClient,
    private readonly workers: WorkerPool,
  ) {}

  async get(sha1: string): Promise<{ value: Buffer | null; failed: boolean }> {
    const z = await this.cache.getQueryResult(sha1);
    if (!z.value) return z;
    const r = await this.workers.run<BytesResult>(z.value, 'gunzip');
    return { value: Buffer.from(r.data), failed: false };
  }

  async set(sha1: string, json: Buffer, ttlSeconds: number): Promise<void> {
    const r = await this.workers.run<BytesResult>(json, 'gzip');
    await this.cache.setQueryResult(sha1, Buffer.from(r.data), ttlSeconds);
  }
}

export class NoopTimeseriesCache implements TimeseriesCachePort {
  readonly implName = 'NoopTimeseriesCache' as const;
  async get(): Promise<{ value: Buffer | null; failed: boolean }> {
    return { value: null, failed: false };
  }
  async set(): Promise<void> {}
}
