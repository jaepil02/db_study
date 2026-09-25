// S4 시계열 — 해상도 · 스냅 · 키 · TTL(06_pipeline/06) · 2차 축소(TSQ-06) · 판정 트리의 캐시 · 락 경로(SW-03 · 04 · 05)
import type { TimeseriesQueryBody } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import type { ClickHouse } from '../src/common/clickhouse/clickhouse.module';
import type { WorkerPool } from '../src/common/workers/worker-pool';
import { lttb, minmax, type Row, reduceSeries } from '../src/modules/timeseries/downsample';
import {
  cacheKey,
  chooseInterval,
  classify,
  floorToBucket,
  normalize,
  RawTimeKeyNormalizer,
  resolveInterval,
  TimeSnapKeyNormalizer,
} from '../src/modules/timeseries/resolution';
import { TimeseriesService } from '../src/modules/timeseries/timeseries.service';
import type { RebuildLockPort, TimeseriesCachePort } from '../src/modules/timeseries/timeseries-cache.port';

const H = 3_600_000;
const D = 24 * H;

describe('해상도 자동 선택 · 상향', () => {
  it('경계 — 1시간 이하 raw · 7일 이하 1m · 90일 이하 1h · 초과 1d', () => {
    expect(chooseInterval(H)).toBe('raw');
    expect(chooseInterval(H + 1)).toBe('1m');
    expect(chooseInterval(7 * D)).toBe('1m');
    expect(chooseInterval(7 * D + 1)).toBe('1h');
    expect(chooseInterval(90 * D)).toBe('1h');
    expect(chooseInterval(90 * D + 1)).toBe('1d');
  });

  it('예상 포인트가 maxPoints를 넘으면 한 단계씩 올린다 — raw 지정도 거절하지 않는다', () => {
    expect(resolveInterval(undefined, 30 * 60_000, 2000)).toBe('raw'); // 1,800점
    expect(resolveInterval(undefined, H, 2000)).toBe('1m'); // raw 3,600점 > 2,000
    expect(resolveInterval('raw', 30 * D, 2000)).toBe('1h'); // raw → 1m 43,200 → 1h 720
    expect(resolveInterval('1m', 365 * D, 100)).toBe('1d');
  });
});

describe('버킷 스냅(SW-04) · 정규화 키', () => {
  it('1d는 KST 자정으로 내린다 — epoch 연산', () => {
    const ms = Date.parse('2026-09-24T20:30:00+09:00');
    expect(new Date(floorToBucket(ms, '1d')).toISOString()).toBe('2026-09-23T15:00:00.000Z');
    expect(floorToBucket(Date.parse('2026-09-24T10:17:31Z'), '1h')).toBe(Date.parse('2026-09-24T10:00:00Z'));
  });

  it('on은 초가 다른 두 요청을 같은 키로 · off는 다른 키로(히트율 0 수렴의 기전)', () => {
    const q = (from: string, to: string) => ({ tagIds: [2, 1], from, to });
    const a = '2026-09-20T10:00:05+09:00';
    const b = '2026-09-20T10:00:47+09:00';
    const to1 = '2026-09-22T10:00:05+09:00';
    const to2 = '2026-09-22T10:00:47+09:00';
    const on = new TimeSnapKeyNormalizer();
    const off = new RawTimeKeyNormalizer();
    expect(cacheKey(normalize(q(a, to1), [1, 2], on))).toBe(cacheKey(normalize(q(b, to2), [2, 1], on)));
    expect(cacheKey(normalize(q(a, to1), [1, 2], off))).not.toBe(cacheKey(normalize(q(b, to2), [1, 2], off)));
  });

  it('집계 순서 · 기본값 명시 여부는 키를 바꾸지 않는다', () => {
    const snap = new TimeSnapKeyNormalizer();
    const base = { tagIds: [1], from: '2026-09-20T00:00:00+09:00', to: '2026-09-22T00:00:00+09:00' };
    const k1 = cacheKey(normalize({ ...base, aggregations: ['max', 'avg'] }, [1], snap));
    const k2 = cacheKey(
      normalize({ ...base, aggregations: ['avg', 'max'], maxPoints: 2000, downsample: 'lttb' }, [1], snap),
    );
    expect(k1).toBe(k2);
    expect(cacheKey(normalize(base, [1], snap))).toBe(
      cacheKey(normalize({ ...base, aggregations: ['avg'] }, [1], snap)),
    );
  });

  it('TTL 구간 — 최근 5분 recent · 선택 해상도의 현재 버킷 current · 그 밖 past', () => {
    const now = Date.parse('2026-09-24T10:30:00Z');
    expect(classify(now - 60_000, now, '1h')).toBe('recent');
    expect(classify(now - 10 * 60_000, now, '1h')).toBe('current'); // 10:20 ≥ 10:00 버킷
    expect(classify(Date.parse('2026-09-24T09:59:00Z'), now, '1h')).toBe('past');
  });
});

describe('2차 축소 — LTTB · minmax(스파이크를 잃지 않는다)', () => {
  const series: Row[] = Array.from({ length: 1000 }, (_, i) => [
    i * 1000,
    i === 437 ? 500 : Math.sin(i / 20),
    9,
  ]);

  it('LTTB는 첫 · 끝 점과 스파이크를 남기고 점 수를 맞춘다', () => {
    const out = lttb(series, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toEqual(series[0]);
    expect(out[99]).toEqual(series[999]);
    expect(out.some((r) => r[1] === 500)).toBe(true);
  });

  it('minmax(raw)는 묶음마다 최소 · 최대 두 점 · 스파이크 보존', () => {
    const out = minmax(series, 100, ['ts', 'value', 'quality']);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.some((r) => r[1] === 500)).toBe(true);
  });

  it('minmax(롤업)는 min의 최솟값 · max의 최댓값', () => {
    const rows: Row[] = Array.from({ length: 10 }, (_, i) => [i, i, -i, i * 2]);
    const out = minmax(rows, 2, ['ts', 'avg', 'min', 'max']);
    expect(out).toEqual([
      [0, 2, -4, 8],
      [5, 7, -9, 18],
    ]);
  });

  it('maxPoints 이하인 태그는 건드리지 않는다', () => {
    const r = reduceSeries({
      series: [series.slice(0, 10), series],
      maxPoints: 50,
      mode: 'lttb',
      columns: ['ts', 'value', 'quality'],
    });
    expect(r.series[0]).toHaveLength(10);
    expect(r.series[1]).toHaveLength(50);
    expect(r.downsampled).toBe(true);
  });
});

/** 판정 트리 — 가짜 캐시 · 락 · ClickHouse */
function harness(opts: { lock: 'on' | 'off' | 'held' | 'fail'; fillAfterWaits?: number; cached?: boolean }) {
  const calls = { source: 0, set: 0, setNx: 0, release: 0, gets: 0 };
  let stored: Buffer | null = null;
  const body: TimeseriesQueryBody = {
    meta: {
      interval: '1m',
      from: 'x',
      to: 'y',
      columns: ['ts', 'avg'],
      pointCount: 0,
      downsampled: false,
      cached: false,
    },
    series: [],
  };
  if (opts.cached) stored = Buffer.from(JSON.stringify(body));
  const cache: TimeseriesCachePort = {
    implName: 'RedisTimeseriesCache',
    get: async () => {
      calls.gets++;
      if (!stored && opts.fillAfterWaits !== undefined && calls.gets > opts.fillAfterWaits)
        stored = Buffer.from(JSON.stringify(body));
      return { value: stored, failed: false };
    },
    set: async () => {
      calls.set++;
    },
    setIfAbsent: async () => {
      calls.setNx++;
    },
  };
  const lock: RebuildLockPort = {
    implName: opts.lock === 'off' ? 'NoopRebuildLock' : 'RedisRebuildLock',
    acquire: async () =>
      opts.lock === 'off'
        ? { token: null, failed: false, disabled: true }
        : opts.lock === 'fail'
          ? { token: null, failed: true }
          : opts.lock === 'held'
            ? { token: null, failed: false }
            : { token: 'T', failed: false },
    release: async () => {
      calls.release++;
    },
  };
  const ch = {
    client: {
      query: async ({ query }: { query: string }) => {
        if (!query.includes('dictGet')) calls.source++;
        return { json: async () => [] };
      },
    },
  } as unknown as ClickHouse;
  const svc = new TimeseriesService(ch, {} as WorkerPool, cache, new TimeSnapKeyNormalizer(), lock);
  const q = { tagIds: [1], from: '2026-09-01T00:00:00+09:00', to: '2026-09-03T00:00:00+09:00' };
  return { svc, q, calls };
}

describe('판정 트리 — 캐시 · 스탬피드 락', () => {
  it('히트면 원천을 부르지 않고 meta.cached 참', async () => {
    const h = harness({ lock: 'on', cached: true });
    const r = await h.svc.query(h.q);
    expect(r.meta.cached).toBe(true);
    expect(h.calls.source).toBe(0);
  });

  it('락 획득 — 원천 1회 · SET · 소유자 해제', async () => {
    const h = harness({ lock: 'on' });
    await h.svc.query(h.q);
    expect(h.calls).toMatchObject({ source: 1, set: 1, release: 1 });
  });

  it('락을 남이 쥐면 대기 중 재조회로 히트 — 원천을 부르지 않는다', async () => {
    const h = harness({ lock: 'held', fillAfterWaits: 2 });
    const r = await h.svc.query(h.q);
    expect(r.meta.cached).toBe(true);
    expect(h.calls.source).toBe(0);
  });

  it('대기 소진 — 락 없이 원천 · NX 쓰기(선행 채움을 덮지 않는다)', async () => {
    const h = harness({ lock: 'held' });
    await h.svc.query(h.q);
    expect(h.calls).toMatchObject({ source: 1, set: 0, setNx: 1 });
  });

  it('SW-05 off · 락 호출 실패 — 락 없이 원천 · 일반 SET', async () => {
    for (const lock of ['off', 'fail'] as const) {
      const h = harness({ lock });
      await h.svc.query(h.q);
      expect(h.calls).toMatchObject({ source: 1, set: 1, release: 0 });
    }
  });
});
