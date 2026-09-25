// S4 웹 순수 로직 — 신호 키 → 쿼리 키(08_screen/01) · 결과 표지 줄 · 진행 구간 · 품질 끊김(08_screen/04) · 비교 성립 · 창 분위수(08_screen/07)
import { describe, expect, it } from 'vitest';
import { actionsForSignal, RECONNECT_ACTIONS } from '../lib/cache-signal';
import {
  counterDelta,
  deviation,
  histQuantile,
  judgeComparability,
  type MeasureWindow,
  restartDetected,
} from '../lib/compare';
import { changedFields, isLoopbackHost } from '../lib/master-api';
import type { MetricSample } from '../lib/metrics-parser';
import type { HealthBody } from '../lib/shared';
import {
  decodeParams,
  encodeParams,
  exportFileName,
  progressRange,
  resultBadges,
  seriesColumns,
  staleTimeFor,
} from '../lib/trend';

describe('무효화 신호 → 쿼리 키(체인 ⑥)', () => {
  it('신호 키 4종 · 모르는 키는 버린다 · timeseries는 무효화하지 않는다', () => {
    const a = actionsForSignal([
      'cache:tagmeta:7',
      'cache:devlist:2',
      'cache:alarmrules',
      'cache:perm:5',
      'cache:q:x',
    ]);
    expect(a).toContainEqual({ kind: 'query', key: ['master', 'tags'] });
    expect(a).toContainEqual({ kind: 'query', key: ['master', 'tag', 7] });
    expect(a).toContainEqual({ kind: 'realtimeTag', tagId: 7 });
    expect(a).toContainEqual({ kind: 'query', key: ['master', 'devices', 2] });
    expect(a).toContainEqual({ kind: 'permNotice', userId: 5 });
    expect(a.filter((x) => x.kind === 'query' && x.key[0] === 'alarm')).toHaveLength(2); // 병합하지 않는다
    expect(a.some((x) => x.kind === 'query' && x.key[0] === 'timeseries')).toBe(false);
  });
  it('재연결 뒤 master 계열 1회', () => {
    expect(RECONNECT_ACTIONS).toEqual([{ kind: 'query', key: ['master'] }]);
  });
});

describe('ANL-TREND 조건 · 표지 줄 · 진행 구간', () => {
  it('쿼리 문자열 왕복 — 사용자 지정 범위는 +09:00 ISO', () => {
    const p = decodeParams(
      new URLSearchParams(
        'tags=3,1,3&from=2026-09-20T00:00:00%2B09:00&to=2026-09-21T00:00:00%2B09:00&interval=1h&aggs=max,avg',
      ),
    );
    expect(p).toMatchObject({ tagIds: [3, 1], preset: null, interval: '1h', aggregations: ['max', 'avg'] });
    expect(encodeParams(p).get('from')).toBe('2026-09-20T00:00:00.000+09:00');
    expect(decodeParams(new URLSearchParams('')).preset).toBe('24h');
  });

  it('요청과 받은 해상도가 다르면 "요청 → 받음" · 캐시 · 버킷 내림 · p95 근사', () => {
    const meta = {
      interval: '1m' as const,
      from: '2026-09-20T00:00:00.000Z',
      to: '2026-09-20T02:00:00.000Z',
      columns: ['ts', 'avg', 'p95'],
      pointCount: 120,
      downsampled: false,
      cached: true,
    };
    const b = resultBadges(meta, {
      interval: 'raw',
      fromMs: Date.parse('2026-09-20T00:00:05Z'),
      toMs: Date.parse('2026-09-20T02:00:00Z'),
    });
    expect(b[0]).toBe('요청 raw → 받음 1m(점 상한 초과로 상향)');
    expect(b).toContain('캐시');
    expect(b.some((x) => x.startsWith('실제 범위'))).toBe(true);
    expect(b).toContain('p95는 근사(TDigest)');
  });

  it('staleTime — 최근 5분 0 · 현재 버킷 24초 · 과거 240초', () => {
    const now = Date.parse('2026-09-24T10:30:00Z');
    expect(staleTimeFor({ interval: '1m', to: '2026-09-24T10:29:00Z' }, now)).toBe(0);
    expect(staleTimeFor({ interval: '1h', to: '2026-09-24T10:00:00Z' }, now)).toBe(24_000);
    expect(staleTimeFor({ interval: '1h', to: '2026-09-24T09:00:00Z' }, now)).toBe(240_000);
  });

  it('진행 구간 — 1차 실제 끝부터 현재까지 같은 해상도 · 1초 안이면 분할 없음', () => {
    const now = Date.parse('2026-09-24T10:30:00Z');
    expect(progressRange({ interval: '1h', to: '2026-09-24T10:00:00Z' }, now)).toEqual({
      fromMs: Date.parse('2026-09-24T10:00:00Z'),
      toMs: now,
      interval: '1h',
    });
    expect(progressRange({ interval: 'raw', to: new Date(now - 500).toISOString() }, now)).toBeNull();
  });

  it('raw는 품질 2 · 4 · 5에서 끊고 9는 잇는다 · 롤업은 min · max가 둘 다 있을 때만 음영', () => {
    const raw = seriesColumns(
      ['ts', 'value', 'quality'],
      [
        [1, 10, 0],
        [2, 11, 2],
        [3, 12, 9],
      ],
    );
    expect(raw.y).toEqual([10, null, 12]);
    expect(seriesColumns(['ts', 'avg', 'min'], [[1, 1, 0]]).lo).toBeNull();
    expect(seriesColumns(['ts', 'avg', 'min', 'max'], [[1, 1, 0, 2]])).toMatchObject({ lo: [0], hi: [2] });
  });

  it('내보내기 도중 중단이면 파일 이름에 불완전', () => {
    expect(exportFileName('csv', Date.parse('2026-09-24T00:00:00+09:00'), false)).toBe(
      'timeseries-202609240000-불완전.csv',
    );
  });
});

describe('ADM-MASTER 도우미', () => {
  it('바뀐 필드만 PATCH · 루프백은 SIMULATED', () => {
    expect(changedFields({ a: 1, b: 'x' }, { a: 1, b: 'y' })).toEqual({ b: 'y' });
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('10.0.0.5')).toBe(false);
  });
});

function health(impl6: string, commit = 'c1'): HealthBody {
  const sw = (impl: string, value: string | number = 'on') => ({ name: 'x', value, impl, warning: null });
  return {
    status: 'ok',
    stores: {},
    switches: {
      'SW-03': sw('RedisTimeseriesCache'),
      'SW-06': sw(impl6, impl6 === 'DirectGatewayFanout' ? 'off' : 'on'),
    },
    run: { commitHash: commit, memoryProfile: 'load', memoryLimitMb: 1, capacityTier: 'M', appRole: 'all' },
  } as unknown as HealthBody;
}

const hist = (le: string, v: number, name = 'rlt_fanout_delivery_seconds_bucket'): MetricSample => ({
  name,
  labels: { channel: 'pubsub', le },
  value: v,
});

function win(id: string, impl6: string, endBuckets: [string, number][], commit = 'c1'): MeasureWindow {
  return {
    id,
    start: {
      atMs: 0,
      health: health(impl6, commit),
      samples: [hist('0.001', 0), hist('0.01', 0), hist('+Inf', 0)],
    },
    end: { atMs: 60_000, health: health(impl6, commit), samples: endBuckets.map(([le, v]) => hist(le, v)) },
  };
}

describe('EXP-COMPARE — 창 분위수 · 비교 성립', () => {
  it('버킷 차의 선형 보간 · 누적 감소는 재기동', () => {
    const w = win('1', 'RedisPubSubFanout', [
      ['0.001', 50],
      ['0.01', 100],
      ['+Inf', 100],
    ]);
    expect(histQuantile(w, 'rlt_fanout_delivery_seconds', 0.5)).toBeCloseTo(0.001);
    expect(histQuantile(w, 'rlt_fanout_delivery_seconds', 0.75)).toBeCloseTo(0.0055);
    expect(counterDelta(w, 'rlt_fanout_delivery_seconds_bucket', { le: '+Inf' })).toBe(100);
    const r = { ...w, start: { ...w.start, samples: [hist('+Inf', 500)] } };
    expect(restartDetected(r)).toBe(true);
  });

  it('성립 — 다른 스위치 하나 · 조건당 3창 · 편차 20% 이내 · 4요소 같음', () => {
    const b = (i: number, n: number) =>
      win(`${i}`, 'RedisPubSubFanout', [
        ['0.001', n],
        ['0.01', 100],
        ['+Inf', 100],
      ]);
    const d = (i: number) =>
      win(`d${i}`, 'DirectGatewayFanout', [
        ['0.001', 90],
        ['0.01', 100],
        ['+Inf', 100],
      ]);
    const A = [b(1, 60), b(2, 60), b(3, 60)];
    const B = [d(1), d(2), d(3)];
    const v = judgeComparability(A, B);
    expect(v).toMatchObject({ ok: true, target: 'SW-06' });
    expect(judgeComparability(A.slice(0, 2), B).ok).toBe(false);
    const other = [
      ...B.slice(0, 2),
      win(
        'x',
        'DirectGatewayFanout',
        [
          ['0.001', 90],
          ['0.01', 100],
          ['+Inf', 100],
        ],
        'c2',
      ),
    ];
    expect(judgeComparability(A, other).reasons.join()).toContain('커밋 해시');
    expect(deviation([10, 11, 13])).toBeCloseTo(3 / 11);
  });
});
