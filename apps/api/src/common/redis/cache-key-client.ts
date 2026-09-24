// CacheKeyClient — 캐시 계열(cache · lock · rl · sess · auth) 래퍼(ADR-13 · 정본 docs/05_data_stores/05_redis_keyspace.md)
// ① TTL은 쓰기 메서드의 필수 인자다 — 빠뜨린 호출은 컴파일되지 않는다 ② PERSIST · KEYS · FLUSH를 노출하지 않는다
// ③ 실패는 짧은 타임아웃(현행 50 ms · 소유 06_pipeline/06) 뒤 조용히 degrade — 결과 없음으로 돌려주고 계수한다
// 지터 ±20%는 cache 접두의 단건 키에만 자동으로 건다 — 락 · rl · auth에 붙이면 만료가 소유자 작업보다 먼저 온다.
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { Counter } from 'prom-client';
import { appRegistry } from '../metrics/registry';
import { RedisConnections } from './connections';

const CACHE_PREFIXES = ['cache:', 'lock:', 'rl:', 'sess:', 'auth:'] as const;
export const CACHE_CALL_TIMEOUT_MS = 50;
const JITTER = 0.2;

const failures = new Counter({
  name: 'cache_wrapper_failures_total',
  help: 'CacheKeyClient가 삼킨 실패(degrade)',
  labelNames: ['prefix', 'op'],
  registers: [appRegistry],
});

function prefixOf(key: string): string {
  const p = CACHE_PREFIXES.find((x) => key.startsWith(x));
  if (!p) throw new Error(`CacheKeyClient는 캐시 계열 키만 다룬다 — ${key}`);
  return p.slice(0, -1);
}

/** TTL 초 — cache 접두면 ±20% 무작위 가산 */
export function jitteredTtlSeconds(key: string, ttlSeconds: number, rnd = Math.random): number {
  if (!key.startsWith('cache:')) return ttlSeconds;
  return Math.max(1, Math.round(ttlSeconds * (1 + (rnd() * 2 - 1) * JITTER)));
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        t = setTimeout(() => reject(new Error('캐시 호출 시간 초과')), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

/** 소유자 검증 해제 — 단순 DEL은 자기 락이 만료된 뒤 남의 락을 지운다 */
const RELEASE_IF_OWNER = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

@Injectable()
export class CacheKeyClient {
  private readonly redis: Redis;

  constructor(conns: RedisConnections) {
    this.redis = conns.command;
    this.redis.defineCommand('releaseIfOwner', { numberOfKeys: 1, lua: RELEASE_IF_OWNER });
  }

  private async degrade<T>(key: string, op: string, fn: () => Promise<T>): Promise<T | null> {
    const prefix = prefixOf(key);
    try {
      return await withTimeout(fn(), CACHE_CALL_TIMEOUT_MS);
    } catch {
      failures.inc({ prefix, op });
      return null;
    }
  }

  /** 조회 — failed는 degrade(타임아웃 · 오류)로 미스가 된 경우다. 부르는 쪽이 미스와 실패를 가려 센다(tsq result error) */
  async getBuffer(key: string): Promise<{ value: Buffer | null; failed: boolean }> {
    const r = await this.degrade(key, 'get', async () => ({ v: await this.redis.getBuffer(key) }));
    return r === null ? { value: null, failed: true } : { value: r.v, failed: false };
  }

  /** 쓰기 — TTL 필수(초). 실패는 버린다 */
  async setWithTtl(key: string, value: Buffer | string, ttlSeconds: number): Promise<void> {
    const ttl = jitteredTtlSeconds(key, ttlSeconds);
    await this.degrade(key, 'set', () => this.redis.set(key, value, 'EX', ttl));
  }

  /** Hash 사본 쓰기(cache:tagmeta) — HSET + EXPIRE를 한 트랜잭션으로 · TTL 필수 */
  async hsetWithTtl(key: string, fields: Record<string, string>, ttlSeconds: number): Promise<void> {
    const ttl = jitteredTtlSeconds(key, ttlSeconds);
    await this.degrade(key, 'hset', () => this.redis.multi().hset(key, fields).expire(key, ttl).exec());
  }

  hgetall(key: string): Promise<Record<string, string> | null> {
    return this.degrade(key, 'hgetall', async () => {
      const r = await this.redis.hgetall(key);
      return Object.keys(r).length ? r : null;
    });
  }

  /** 여러 Hash 사본을 파이프라인 1회로 — 태그 수만큼 왕복하지 않는다. 호출 실패면 전부 null(미스와 같게 다룬다) */
  async hgetallMany(keys: string[]): Promise<(Record<string, string> | null)[]> {
    if (keys.length === 0) return [];
    const first = keys[0] as string;
    const r = await this.degrade(first, 'hgetall', async () => {
      const p = this.redis.pipeline();
      for (const k of keys) {
        prefixOf(k);
        p.hgetall(k);
      }
      return (await p.exec()) ?? [];
    });
    if (!r) return keys.map(() => null);
    return r.map(([err, v]) => {
      if (err || !v || typeof v !== 'object') return null;
      return Object.keys(v).length ? (v as Record<string, string>) : null;
    });
  }

  /**
   * 락 획득 — SET NX PX · 값 = 소유자 토큰. 락 계열은 지터를 붙이지 않는다.
   * token: 획득하면 토큰 · 남이 쥐고 있으면 null / failed: 호출 자체가 실패(degrade — 락 없이 원천 조회로 간다)
   */
  async acquireLock(key: string, ttlMs: number): Promise<{ token: string | null; failed: boolean }> {
    const token = randomUUID();
    const r = await this.degrade(
      key,
      'lock',
      async () => (await this.redis.set(key, token, 'PX', ttlMs, 'NX')) ?? 'HELD',
    );
    if (r === null) return { token: null, failed: true };
    return { token: r === 'OK' ? token : null, failed: false };
  }

  async releaseLock(key: string, token: string): Promise<void> {
    await this.degrade(key, 'unlock', () =>
      (this.redis as unknown as { releaseIfOwner(k: string, t: string): Promise<number> }).releaseIfOwner(
        key,
        token,
      ),
    );
  }

  async del(key: string): Promise<void> {
    await this.degrade(key, 'del', () => this.redis.del(key));
  }
}
