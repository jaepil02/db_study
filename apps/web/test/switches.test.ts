import { describe, expect, it } from 'vitest';
import type { HealthBody } from '../lib/shared';
import { buildSwitchRows, comboWarnings, countNonDefault, recordConditionBlock } from '../lib/switches';
import { backoffMs, shouldReconnect } from '../lib/ws-policy';

const health: HealthBody = {
  status: 'ok',
  checkedAt: '2026-09-24T01:00:00.000Z',
  stores: {
    postgres: { status: 'up', latencyMs: 2, error: null },
    clickhouse: { status: 'up', latencyMs: 5, error: null },
    redis: { status: 'up', latencyMs: 1, error: null },
  },
  switches: {
    'SW-02': { name: 'REDIS_LATEST_CACHE', value: 'off', impl: 'ClickHouseLatestValueReader', warning: null },
    'SW-03': { name: 'REDIS_QUERY_CACHE', value: 'on', impl: 'RedisTimeseriesCache', warning: null },
    'SW-99': { name: 'FUTURE', value: 'on', impl: 'X', warning: null },
  },
  run: { commitHash: 'a1b2c3d', memoryProfile: 'load', memoryLimitMb: 4096, capacityTier: 'S' },
};

describe('스위치 표', () => {
  const rows = buildSwitchRows(health.switches);

  it('health에 있는 스위치는 기본값과 비교 · 없는 스위치는 도입 전', () => {
    const sw02 = rows.find((r) => r.kind === 'present' && r.spec.id === 'SW-02');
    expect(sw02).toMatchObject({ sameAsDefault: false, defaultImpl: 'RedisLatestValueReader' });
    expect(rows.find((r) => r.kind === 'present' && r.spec.id === 'SW-03')).toMatchObject({
      sameAsDefault: true,
    });
    expect(rows.filter((r) => r.kind === 'not_introduced')).toHaveLength(9);
    expect(countNonDefault(rows)).toBe(1);
  });

  it('목록에 없는 스위치는 숨기지 않는다', () => {
    expect(rows.find((r) => r.kind === 'unknown')).toMatchObject({ id: 'SW-99' });
  });

  it('SW-07은 창 값까지 비교한다', () => {
    const r = buildSwitchRows({
      'SW-07': { name: 'WS_THROTTLE_MS', value: 50, impl: 'WindowMergeThrottle', warning: null },
    }).find((x) => x.kind === 'present');
    expect(r).toMatchObject({ sameAsDefault: false });
  });
});

describe('조합 경고', () => {
  it('SW-02 대안이면 #7 · health에 없는 스위치는 판정하지 않는다', () => {
    expect(comboWarnings(health.switches).map((w) => w.no)).toEqual([7]);
  });

  it('SW-01 대안이면 #2 · #3', () => {
    const w = comboWarnings({
      'SW-01': {
        name: 'REDIS_STREAM_BUFFER',
        value: 'off',
        impl: 'InProcessQueueBuffer',
        warning: 'stream_boundary_bypassed',
      },
    });
    expect(w.map((x) => x.no)).toEqual([2, 3]);
  });
});

describe('기록 조건 블록', () => {
  it('4요소를 health에서 채우고 게이트만 수기', () => {
    const text = recordConditionBlock(health);
    expect(text).toContain('| 커밋 | a1b2c3d |');
    expect(text).toContain('| 프로파일 · 상한 | load · 4096 MB |');
    expect(text).toContain('| 용량 티어 | S |');
    expect(text).toContain('| 스위치 | SW-02=off · 그 외 기본값 |');
    expect(text).toContain('| 게이트 | ? |');
  });

  it('run 값이 null이면 인용 불가 표지', () => {
    const text = recordConditionBlock({
      ...health,
      run: { commitHash: null, memoryProfile: null, memoryLimitMb: null, capacityTier: null },
    });
    expect(text).toContain('| 커밋 | (없음 — 4요소 누락 · 인용 불가) |');
  });
});

describe('impl null — 도입 전 스위치(health가 11키 전부를 싣는다)', () => {
  const withNull: HealthBody['switches'] = {
    ...health.switches,
    'SW-09': { name: 'CONTROL_TABLE_ENABLED', value: 'on', impl: null, warning: null },
    'SW-11': { name: 'LATEST_VALUE_WRITER', value: 'collector', impl: null, warning: null },
  };

  it('impl null이면 도입 전 행 · 기동 설정값을 싣고 기본값과 비교하지 않는다', () => {
    const rows = buildSwitchRows(withNull);
    expect(rows.find((r) => r.kind === 'not_introduced' && r.spec.id === 'SW-09')).toMatchObject({
      value: 'on',
    });
    expect(rows.find((r) => r.kind === 'not_introduced' && r.spec.id === 'SW-04')).toMatchObject({
      value: null,
    });
    expect(countNonDefault(rows)).toBe(1);
  });

  it('impl null은 조합 경고를 판정하지 않는다(SW-09 on · SW-11 collector여도 #4 · #9 없음)', () => {
    expect(comboWarnings(withNull).map((w) => w.no)).toEqual([7]);
  });

  it('기록 블록 전수 줄은 11키를 다 싣고 도입 전은 value(도입 전)', () => {
    const text = recordConditionBlock({ ...health, switches: withNull });
    const line = text.split('\n').find((l) => l.startsWith('| 스위치 전수')) ?? '';
    for (let i = 1; i <= 11; i++) expect(line).toContain(`SW-${String(i).padStart(2, '0')}=`);
    expect(line).toContain('SW-09=on(도입 전)');
    expect(line).toContain('SW-11=collector(도입 전)');
    expect(line).toContain('SW-02=off(ClickHouseLatestValueReader)');
  });

  it('목록에 없는 스위치의 impl null도 행으로 보인다', () => {
    const rows = buildSwitchRows({ 'SW-99': { name: 'FUTURE', value: 'on', impl: null, warning: null } });
    expect(rows.find((r) => r.kind === 'unknown')).toMatchObject({ id: 'SW-99', impl: null });
  });
});

describe('WebSocket 재연결 정책', () => {
  it('종료 코드별 재연결 여부', () => {
    expect(shouldReconnect(1000)).toBe(false);
    expect(shouldReconnect(1001)).toBe(true);
    expect(shouldReconnect(4400)).toBe(false);
    expect(shouldReconnect(4401)).toBe(false);
    expect(shouldReconnect(4403)).toBe(false);
    expect(shouldReconnect(4408)).toBe(true);
    expect(shouldReconnect(4413)).toBe(true);
    expect(shouldReconnect(4503)).toBe(true);
    expect(shouldReconnect(1006)).toBe(true);
  });

  it('지수 백오프 1 · 2 · 4 … 최대 30초', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});
