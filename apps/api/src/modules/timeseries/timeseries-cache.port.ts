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
  /** 대기 소진 뒤 쓰기 — 선행 채움을 덮지 않는다(NX) */
  setIfAbsent(sha1: string, json: Buffer, ttlSeconds: number): Promise<void>;
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

  async setIfAbsent(sha1: string, json: Buffer, ttlSeconds: number): Promise<void> {
    const r = await this.workers.run<BytesResult>(json, 'gzip');
    await this.cache.setQueryResultIfAbsent(sha1, Buffer.from(r.data), ttlSeconds);
  }
}

export class NoopTimeseriesCache implements TimeseriesCachePort {
  readonly implName = 'NoopTimeseriesCache' as const;
  async get(): Promise<{ value: Buffer | null; failed: boolean }> {
    return { value: null, failed: false };
  }
  async set(): Promise<void> {}
  async setIfAbsent(): Promise<void> {}
}

// SW-05 CACHE_STAMPEDE_LOCK — RebuildLockPort(정본 04_architecture/02 · 기전 06_pipeline/06 §스탬피드 방지)
// on: lock:rebuild:q:{sha1} SET NX PX(5000 ms) · 소유자 검증 해제 / off: 락 없음 — 미스 시 동시 요청 전원이 원천을 부른다

export const REBUILD_LOCK_PORT = Symbol('RebuildLockPort');
/** 락 만료 · 대기 — 2계층 현행 참고(소유 06_pipeline/06) · 관계 "대기 총량 ≥ 재구성 p95"는 EXP-10이 판정한다 */
export const REBUILD_LOCK_TTL_MS = 5000;
export const REBUILD_WAIT_MS = 50;
export const REBUILD_WAIT_TRIES = 3;

export interface RebuildLockPort {
  readonly implName: 'RedisRebuildLock' | 'NoopRebuildLock';
  /** token: 획득 · null: 남이 쥠 · failed: 호출 실패(락 없이 원천) · disabled: off 구현 */
  acquire(sha1: string): Promise<{ token: string | null; failed: boolean; disabled?: boolean }>;
  release(sha1: string, token: string): Promise<void>;
}

export class RedisRebuildLock implements RebuildLockPort {
  readonly implName = 'RedisRebuildLock' as const;
  constructor(private readonly cache: CacheKeyClient) {}
  acquire(sha1: string) {
    return this.cache.acquireQueryRebuildLock(sha1, REBUILD_LOCK_TTL_MS);
  }
  release(sha1: string, token: string) {
    return this.cache.releaseQueryRebuildLock(sha1, token);
  }
}

export class NoopRebuildLock implements RebuildLockPort {
  readonly implName = 'NoopRebuildLock' as const;
  async acquire() {
    return { token: null, failed: false, disabled: true };
  }
  async release(): Promise<void> {}
}
