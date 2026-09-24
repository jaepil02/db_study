import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigRejectedError, loadConfig, readMemoryLimitMb, runInfo } from '../src/config/app-config';

const base = { WORKER_POOL_SIZE: '2' };

describe('설정 로더 — 기동 시 1회 · 허용값 밖이면 기동 거부', () => {
  it('기본값 — APP_ROLE all · 스위치 기본값 11(정본 02_features/13)', () => {
    const c = loadConfig(base);
    expect(c.appRole).toBe('all');
    expect(c.switches).toEqual({
      'SW-01': 'on',
      'SW-02': 'on',
      'SW-03': 'on',
      'SW-04': 'on',
      'SW-05': 'on',
      'SW-06': 'on',
      'SW-07': 100,
      'SW-08': 'on',
      'SW-09': 'off',
      'SW-10': 'off',
      'SW-11': 'ingest',
    });
    expect(c.memoryProfile).toBeNull();
    expect(c.capacityTier).toBeNull();
    expect(c.commitHash).toBeNull();
  });

  it('주입값을 읽는다', () => {
    const c = loadConfig({
      ...base,
      APP_ROLE: 'datagen',
      MEMORY_PROFILE: 'load',
      CAPACITY_TIER: 'M+',
      COMMIT_HASH: 'a7765f8',
      WS_THROTTLE_MS: '0',
      LATEST_VALUE_WRITER: 'collector',
    });
    expect(c).toMatchObject({
      appRole: 'datagen',
      memoryProfile: 'load',
      capacityTier: 'M+',
      commitHash: 'a7765f8',
    });
    expect(c.switches['SW-07']).toBe(0);
    expect(c.switches['SW-11']).toBe('collector');
  });

  it.each([
    ['APP_ROLE 허용값 밖', { ...base, APP_ROLE: 'everything' }],
    ['WORKER_POOL_SIZE 없음', {}],
    ['WORKER_POOL_SIZE 0', { WORKER_POOL_SIZE: '0' }],
    ['티어 허용값 밖', { ...base, CAPACITY_TIER: 'XL' }],
    ['커밋 해시 모양 아님', { ...base, COMMIT_HASH: 'HEAD' }],
  ])('%s → 기동 거부', (_n, env) => {
    expect(() => loadConfig(env)).toThrow(ConfigRejectedError);
  });

  it('스위치 허용값 밖 → 기동은 하고 기본 구현 주입 · 경고 · runInfo가 실제 주입값을 보인다', () => {
    const c = loadConfig({ ...base, REDIS_LATEST_CACHE: 'of', WS_THROTTLE_MS: '-1' });
    expect(c.switches['SW-02']).toBe('on');
    expect(c.switches['SW-07']).toBe(100);
    expect(c.switchWarnings).toHaveLength(2);
    expect(runInfo(c, null).switches['SW-02']).toBe('on');
  });

  it('memoryLimitMb는 cgroup에서 읽는다 — max면 null', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cg-'));
    writeFileSync(join(dir, 'a'), '2147483648\n');
    writeFileSync(join(dir, 'b'), 'max\n');
    expect(readMemoryLimitMb(join(dir, 'a'))).toBe(2048);
    expect(readMemoryLimitMb(join(dir, 'b'))).toBeNull();
    expect(readMemoryLimitMb(join(dir, 'none'))).toBeNull();
    expect(runInfo(loadConfig(base), 2048).run.memoryLimitMb).toBe(2048);
  });
});
