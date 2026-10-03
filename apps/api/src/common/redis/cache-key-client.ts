// CacheKeyClient — 캐시 계열(cache · lock · rl · sess · auth · biz) 래퍼(ADR-13 · 정본 docs/05_data_stores/05_redis_keyspace.md)
// ① TTL은 쓰기 메서드의 필수 인자다 — 빠뜨린 호출은 컴파일되지 않는다 ② PERSIST · KEYS · FLUSH를 노출하지 않는다
// ③ 실패는 짧은 타임아웃(현행 50 ms · 소유 06_pipeline/06) 뒤 조용히 degrade — 결과 없음으로 돌려주고 계수한다
//    lock:biz:writer 연산만 긴 타임아웃(LOCK_CALL_TIMEOUT_MS) — 갱신 실패는 소비 중단이라 응답 지연을 상실로 읽지 않는다
// 지터 ±20%는 cache 접두의 단건 키에만 자동으로 건다 — 락 · rl · auth에 붙이면 만료가 소유자 작업보다 먼저 온다.
// ④ 공개 메서드는 용도 이름과 식별자만 받는다 — 키 문자열(접두)은 래퍼가 스스로 만든다(05_redis_keyspace §키 계열별 래퍼 강제 · S3).
//    호출자가 접두를 쓰면 봉인 접두를 캐시 래퍼로 쓰는 실수가 타입을 통과한다 — 원시 키 메서드는 private이다.
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { Counter } from 'prom-client';
import { appRegistry } from '../metrics/registry';
import { RedisConnections } from './connections';

const CACHE_PREFIXES = ['cache:', 'lock:', 'rl:', 'sess:', 'auth:', 'biz:'] as const;
export const CACHE_CALL_TIMEOUT_MS = 50;
/** lock:biz:writer 연산(획득 · 갱신 · 해제) 타임아웃 — 50 ms에 걸린 갱신을 락 상실로 읽으면 소비가 이유 없이 멈춘다(TTL 15초 · 주기 5초 여유) */
export const LOCK_CALL_TIMEOUT_MS = 500;
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

/** 소유자 검증 갱신 — 남의 락(내 락이 만료된 뒤 다른 워커가 쥔 것)의 만료를 늘리지 않는다 */
const RENEW_IF_OWNER = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
return 0
`;

/** 획득 또는 이어 쓰기 — 비었으면 SET PX(1) · 값이 내 토큰이면 PEXPIRE(2 — 앞 호출이 응답만 잃은 획득 · 갱신) · 남이 쥐면 0 */
const ACQUIRE_OR_RESUME = `
local v = redis.call('GET', KEYS[1])
if not v then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end
if v == ARGV[1] then redis.call('PEXPIRE', KEYS[1], ARGV[2]) return 2 end
return 0
`;

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
    this.redis.defineCommand('renewIfOwner', { numberOfKeys: 1, lua: RENEW_IF_OWNER });
    this.redis.defineCommand('acquireOrResume', { numberOfKeys: 1, lua: ACQUIRE_OR_RESUME });
  }

  /** 지터 없는 쓰기 — 표지 · 결과 키처럼 만료 시각이 계약인 키(TTL 필수) */
  private async setExact(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    return (await this.degrade(key, 'set', () => this.redis.set(key, value, 'EX', ttlSeconds))) !== null;
  }

  private async degrade<T>(
    key: string,
    op: string,
    fn: () => Promise<T>,
    timeoutMs = CACHE_CALL_TIMEOUT_MS,
  ): Promise<T | null> {
    const prefix = prefixOf(key);
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch {
      failures.inc({ prefix, op });
      return null;
    }
  }

  /** 조회 — failed는 degrade(타임아웃 · 오류)로 미스가 된 경우다. 부르는 쪽이 미스와 실패를 가려 센다(tsq result error) */
  private async getBuffer(key: string): Promise<{ value: Buffer | null; failed: boolean }> {
    const r = await this.degrade(key, 'get', async () => ({ v: await this.redis.getBuffer(key) }));
    return r === null ? { value: null, failed: true } : { value: r.v, failed: false };
  }

  /** 쓰기 — TTL 필수(초). 실패는 버린다 */
  private async setWithTtl(key: string, value: Buffer | string, ttlSeconds: number): Promise<void> {
    const ttl = jitteredTtlSeconds(key, ttlSeconds);
    await this.degrade(key, 'set', () => this.redis.set(key, value, 'EX', ttl));
  }

  /** Hash 사본 쓰기(cache:tagmeta) — HSET + EXPIRE를 한 트랜잭션으로 · TTL 필수 */
  private async hsetWithTtl(key: string, fields: Record<string, string>, ttlSeconds: number): Promise<void> {
    const ttl = jitteredTtlSeconds(key, ttlSeconds);
    await this.degrade(key, 'hset', () => this.redis.multi().hset(key, fields).expire(key, ttl).exec());
  }

  private hgetall(key: string): Promise<Record<string, string> | null> {
    return this.degrade(key, 'hgetall', async () => {
      const r = await this.redis.hgetall(key);
      return Object.keys(r).length ? r : null;
    });
  }

  /** 여러 Hash 사본을 파이프라인 1회로 — 태그 수만큼 왕복하지 않는다. 호출 실패면 전부 null(미스와 같게 다룬다) */
  private async hgetallMany(keys: string[]): Promise<(Record<string, string> | null)[]> {
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
  private async acquireLock(key: string, ttlMs: number): Promise<{ token: string | null; failed: boolean }> {
    const token = randomUUID();
    const r = await this.degrade(
      key,
      'lock',
      async () => (await this.redis.set(key, token, 'PX', ttlMs, 'NX')) ?? 'HELD',
    );
    if (r === null) return { token: null, failed: true };
    return { token: r === 'OK' ? token : null, failed: false };
  }

  private async releaseLock(key: string, token: string): Promise<void> {
    await this.degrade(key, 'unlock', () =>
      (this.redis as unknown as { releaseIfOwner(k: string, t: string): Promise<number> }).releaseIfOwner(
        key,
        token,
      ),
    );
  }

  /** 삭제 — 성공이면 true(키가 없었어도 성공) · degrade면 false(체인 ② 실패 계수의 근거) */
  private async del(key: string): Promise<boolean> {
    return (await this.degrade(key, 'del', () => this.redis.del(key))) !== null;
  }

  // ── 용도별 공개 메서드 — 키 모양의 정본 05_redis_keyspace §키 패턴

  /** cache:q:{sha1} — 시계열 조회 결과(gzip 바이트) · failed는 degrade로 미스가 된 경우 */
  getQueryResult(sha1: string): Promise<{ value: Buffer | null; failed: boolean }> {
    return this.getBuffer(`cache:q:${sha1}`);
  }

  setQueryResult(sha1: string, gz: Buffer, ttlSeconds: number): Promise<void> {
    return this.setWithTtl(`cache:q:${sha1}`, gz, ttlSeconds);
  }

  /** cache:tagmeta:{tag_id} 여러 개 — 파이프라인 1회 */
  getTagMetaMany(tagIds: number[]): Promise<(Record<string, string> | null)[]> {
    return this.hgetallMany(tagIds.map((id) => `cache:tagmeta:${id}`));
  }

  setTagMeta(tagId: number, fields: Record<string, string>, ttlSeconds: number): Promise<void> {
    return this.hsetWithTtl(`cache:tagmeta:${tagId}`, fields, ttlSeconds);
  }

  /** 체인 ② — cache:tagmeta:{tag_id} 삭제(태그 쓰기 커밋 뒤) · 실패면 false */
  delTagMeta(tagId: number): Promise<boolean> {
    return this.del(`cache:tagmeta:${tagId}`);
  }

  /** cache:devlist:{site_id} — 사이트의 설비 목록 JSON 사본(MST-02 #2) · failed는 degrade(부르는 쪽이 mst_cache_requests_total error로 센다) */
  async getDevList(siteId: number): Promise<{ value: string | null; failed: boolean }> {
    const r = await this.getBuffer(`cache:devlist:${siteId}`);
    return { value: r.value ? r.value.toString('utf8') : null, failed: r.failed };
  }

  setDevList(siteId: number, json: string, ttlSeconds: number): Promise<void> {
    return this.setWithTtl(`cache:devlist:${siteId}`, json, ttlSeconds);
  }

  /** 체인 ② — cache:devlist:{site_id} 삭제(설비 쓰기 커밋 뒤) · 실패면 false */
  delDevList(siteId: number): Promise<boolean> {
    return this.del(`cache:devlist:${siteId}`);
  }

  /** lock:rebuild:q:{sha1} — 시계열 캐시 재구성 락(TSQ-05 · SW-05) · 만료 PX · 값 = 소유자 토큰 */
  acquireQueryRebuildLock(sha1: string, ttlMs: number): Promise<{ token: string | null; failed: boolean }> {
    return this.acquireLock(`lock:rebuild:q:${sha1}`, ttlMs);
  }

  releaseQueryRebuildLock(sha1: string, token: string): Promise<void> {
    return this.releaseLock(`lock:rebuild:q:${sha1}`, token);
  }

  /** 대기 소진 뒤 쓰기 — 선행 채움을 덮지 않는다(SET NX EX · 06_pipeline/06 §스탬피드 방지) */
  async setQueryResultIfAbsent(sha1: string, gz: Buffer, ttlSeconds: number): Promise<void> {
    const key = `cache:q:${sha1}`;
    const ttl = jitteredTtlSeconds(key, ttlSeconds);
    await this.degrade(key, 'set', () => this.redis.set(key, gz, 'EX', ttl, 'NX'));
  }

  /** lock:rebuild:rt:{device_id} — 빈 키 복원 락(RLT-04) */
  acquireRtRebuildLock(deviceId: number, ttlMs: number): Promise<{ token: string | null; failed: boolean }> {
    return this.acquireLock(`lock:rebuild:rt:${deviceId}`, ttlMs);
  }

  releaseRtRebuildLock(deviceId: number, token: string): Promise<void> {
    return this.releaseLock(`lock:rebuild:rt:${deviceId}`, token);
  }

  /** cache:alarmrules — 활성 규칙 전체 JSON(쓰기 주체는 판정기 하나 · 05_redis_keyspace) · failed는 degrade(부르는 쪽이 PostgreSQL 직행 · 채우지 않는다) */
  async getAlarmRules(): Promise<{ value: string | null; failed: boolean }> {
    const r = await this.getBuffer('cache:alarmrules');
    return { value: r.value ? r.value.toString('utf8') : null, failed: r.failed };
  }

  /** 현행 TTL 300초 · 쓰기 시 ±20% 지터(05_redis_keyspace §TTL 조회 계약) */
  setAlarmRules(json: string, ttlSeconds = 300): Promise<void> {
    return this.setWithTtl('cache:alarmrules', json, ttlSeconds);
  }

  /** 체인 ② — 규칙 쓰기 커밋 뒤 DEL(내용은 판정기가 다시 채운다) */
  delAlarmRules(): Promise<boolean> {
    return this.del('cache:alarmrules');
  }

  /** cache:alarmevents — 목록 Hash 필드(정규화 쿼리 SHA-1) · 값 gzip JSON */
  getAlarmEventsPage(sha1: string): Promise<Buffer | null> {
    const key = 'cache:alarmevents';
    return this.degrade(key, 'hget', () => this.redis.hgetBuffer(key, sha1));
  }

  /** 필드 채움 + 첫 채움 기준 만료(EXPIRE NX) · 지터 없음 — 필드마다 만료를 갱신하면 인기 조합이 영원히 낡지 않는다 */
  async setAlarmEventsPage(sha1: string, gz: Buffer, ttlSeconds: number): Promise<void> {
    const key = 'cache:alarmevents';
    await this.degrade(key, 'hset', () =>
      this.redis.multi().hset(key, sha1, gz).expire(key, ttlSeconds, 'NX').exec(),
    );
  }

  /** 체인 ② — 확인 커밋 뒤 키 하나 DEL */
  delAlarmEvents(): Promise<boolean> {
    return this.del('cache:alarmevents');
  }

  // ── 업무 명령(06_pipeline/07 §업무 명령 경로) · 흐름 표지(07_api/11 §흐름 이벤트)

  /** biz:result:{cmdId} — 결과 JSON · failed는 degrade(부르는 쪽이 원장으로 간다 · 다시 채우지 않는다) */
  async getBizResult(cmdId: string): Promise<{ value: string | null; failed: boolean }> {
    const r = await this.getBuffer(`biz:result:${cmdId}`);
    return { value: r.value ? r.value.toString('utf8') : null, failed: r.failed };
  }

  /** 결과 SET — 명령 워커만 쓴다 · TTL = 명령 유효 창(지터 없음) · 실패면 false */
  setBizResult(cmdId: string, json: string, ttlSeconds: number): Promise<boolean> {
    return this.setExact(`biz:result:${cmdId}`, json, ttlSeconds);
  }

  /**
   * lock:biz:writer — 업무 명령 단일 소비자 선점(지터 없음 · 값 = 워커 인스턴스 토큰 · 타임아웃 LOCK_CALL_TIMEOUT_MS).
   * acquired: 비어 있어 쥐었다 · resumed: 이미 내 토큰이라 이어 쓴다 · held: 남이 쥐었다 · failed: 호출 실패(타임아웃 · 오류)
   */
  async acquireBizWriterLock(
    token: string,
    ttlMs: number,
  ): Promise<'acquired' | 'resumed' | 'held' | 'failed'> {
    const key = 'lock:biz:writer';
    const r = await this.degrade(
      key,
      'lock',
      () =>
        (
          this.redis as unknown as { acquireOrResume(k: string, t: string, ms: string): Promise<number> }
        ).acquireOrResume(key, token, String(ttlMs)),
      LOCK_CALL_TIMEOUT_MS,
    );
    if (r === null) return 'failed';
    return r === 1 ? 'acquired' : r === 2 ? 'resumed' : 'held';
  }

  /** 토큰이 같을 때만 만료 연장 — lost(0)면 락을 잃었다 · uncertain(타임아웃 · 오류)은 소유 여부를 모른다(부르는 쪽이 다음 틱에 다시) */
  async renewBizWriterLock(token: string, ttlMs: number): Promise<'renewed' | 'lost' | 'uncertain'> {
    const key = 'lock:biz:writer';
    const r = await this.degrade(
      key,
      'renew',
      () =>
        (
          this.redis as unknown as { renewIfOwner(k: string, t: string, ms: string): Promise<number> }
        ).renewIfOwner(key, token, String(ttlMs)),
      LOCK_CALL_TIMEOUT_MS,
    );
    if (r === null) return 'uncertain';
    return r === 1 ? 'renewed' : 'lost';
  }

  async releaseBizWriterLock(token: string): Promise<void> {
    const key = 'lock:biz:writer';
    await this.degrade(
      key,
      'unlock',
      () =>
        (this.redis as unknown as { releaseIfOwner(k: string, t: string): Promise<number> }).releaseIfOwner(
          key,
          token,
        ),
      LOCK_CALL_TIMEOUT_MS,
    );
  }

  /** cache:flow:subscribed — 흐름 구독 표지 읽기 · failed면 부르는 쪽은 발행하지 않는다 */
  async getFlowSubscribed(): Promise<{ present: boolean; failed: boolean }> {
    const key = 'cache:flow:subscribed';
    const r = await this.degrade(key, 'exists', async () => ({ n: await this.redis.exists(key) }));
    return r === null ? { present: false, failed: true } : { present: r.n > 0, failed: false };
  }

  /** 표지 갱신 — 게이트웨이가 흐름 구독 연결이 있는 동안 주기적으로(TTL · 지터 없음) */
  setFlowSubscribed(owner: string, ttlSeconds: number): Promise<boolean> {
    return this.setExact('cache:flow:subscribed', owner, ttlSeconds);
  }
}
