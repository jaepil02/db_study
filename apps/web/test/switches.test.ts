import { describe, expect, it } from 'vitest';
import type { HealthBody } from '../lib/shared';
import {
  buildSwitchRows,
  comboWarnings,
  conditionsSummary,
  countNonDefault,
  healthTip,
} from '../lib/switches';
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
  run: {
    commitHash: 'a1b2c3d',
    memoryProfile: 'load',
    memoryLimitMb: 4096,
    capacityTier: 'S',
    sensorAutogen: 'on',
  },
};

describe('스위치 표', () => {
  const rows = buildSwitchRows(health.switches);

  it('health에 있는 스위치는 기본값과 비교 · 없는 스위치는 도입 전', () => {
    const sw02 = rows.find((r) => r.kind === 'present' && r.spec.id === 'SW-02');
    expect(sw02).toMatchObject({ sameAsDefault: false, defaultImpl: 'RedisLatestValueReader' });
    expect(rows.find((r) => r.kind === 'present' && r.spec.id === 'SW-03')).toMatchObject({
      sameAsDefault: true,
    });
    expect(rows.filter((r) => r.kind === 'not_introduced')).toHaveLength(10);
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

describe('SW-12 BIZ_WRITE_PATH', () => {
  const stream = { name: 'BIZ_WRITE_PATH', value: 'stream', impl: 'StreamBizWriter', warning: null };
  const direct = { name: 'BIZ_WRITE_PATH', value: 'direct', impl: 'DirectBizWriter', warning: null };

  it('direct는 다름으로 센다 · stream(기본값)은 같음 · 둘 다 조합 경고 없음(#10은 판정하지 않는다)', () => {
    const rows = buildSwitchRows({ 'SW-12': direct });
    expect(rows.find((x) => x.kind === 'present' && x.spec.id === 'SW-12')).toMatchObject({
      sameAsDefault: false,
      defaultImpl: 'StreamBizWriter',
    });
    expect(countNonDefault(rows)).toBe(1);
    expect(countNonDefault(buildSwitchRows({ 'SW-12': stream }))).toBe(0);
    expect(comboWarnings({ 'SW-12': stream })).toEqual([]);
    expect(comboWarnings({ 'SW-12': direct })).toEqual([]);
  });
});

describe('각주 툴팁 — 스위치 코드 · 조합 경고 · 저장소 상태는 마우스 올림에만', () => {
  it('응답 전 · 실패 · 다른 스위치 · 조합 경고 · 저장소', () => {
    expect(healthTip(null, false)).toBe('구성을 읽는 중이에요');
    expect(healthTip(null, true)).toBe('구성을 읽지 못했어요');
    const tip = healthTip(health, false);
    expect(tip).toContain('스위치: SW-02=off');
    expect(tip).toContain('조합 경고 #7');
    expect(tip).toContain('postgres up');
    expect(healthTip({ ...health, switches: {} }, false)).toContain('스위치: 전부 기본값');
    // 조합 경고 문장도 쉬운 존댓말(D-15)
    expect(tip).toContain(
      '조합 경고 #7 — SW-11 비교는 이 구성으로 재지 않아요 — 최신값 조회가 rt:latest를 읽지 않아요',
    );
    expect(tip).not.toMatch(/다(\n|$| )/); // 반말 종결(…다) 없음
  });
});

describe('구성 요약 한 줄', () => {
  it('응답 전 · 실패 · 기본값 · 다름 · 저장소 down', () => {
    expect(conditionsSummary(null, false)).toBe('읽는 중이에요');
    expect(conditionsSummary(null, true)).toBe('구성을 읽지 못했어요');
    expect(conditionsSummary({ ...health, switches: {} }, false)).toBe('스위치는 전부 기본값이에요');
    expect(conditionsSummary(health, false)).toBe('기본값과 다른 스위치 1개');
    expect(
      conditionsSummary(
        {
          ...health,
          status: 'degraded',
          stores: { ...health.stores, redis: { status: 'down', latencyMs: null, error: 'refused' } },
        },
        false,
      ),
    ).toBe('기본값과 다른 스위치 1개 · 내려간 저장소 1개');
  });
});
