// 센서 데이터 현황 · 지우기(D-16 결정 5) — 계약 packages/shared/src/api/data.ts
// 409 data.purge_blocked 세 이유(실행 · 설비 가동(원하는 상태 · 켜는 중 · 수집기 적용) · 대기줄 적체) · 지우는 동안 잠금(r5 M4) ·
// 지우기 순서와 본문 · 현황 캐시 · 비교 구간 행 수(compareRows) · 표면 상태 코드 · JSON 본문 필수(지침서 §5-4).
import 'reflect-metadata';
import { ErrorEnvelope, SensorDataStats, SensorPurgeResult } from '@db-study/shared';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiExceptionFilter } from '../src/common/http/exception-filter';
import { SensorPurgeLock } from '../src/modules/plant/sensor-purge-lock';
import type { TimeRange } from '../src/modules/runs/compare-range';
import type { SensorStores } from '../src/modules/runs/compare-stores';
import type { LastIngest } from '../src/modules/runs/run-result';
import {
  SENSOR_DATA,
  SensorDataController,
  SensorDataService,
  STATS_CACHE_MS,
} from '../src/modules/runs/sensor-data';

const RANGE: TimeRange = {
  start: Date.parse('2026-10-07T00:00:00Z'),
  end: Date.parse('2026-10-07T01:00:00Z'),
};

function fakeStores() {
  const calls: string[] = [];
  const st = {
    ch: { rows: 1000, bytes: 5000 },
    pg: { rows: 900, bytes: 90000 },
    last: {
      runId: '00000000-0000-4000-8000-000000000001',
      status: 'completed',
      range: RANGE,
      rows: { clickhouse: 831_600, postgres: 831_600 },
      published: null,
    } as LastIngest | null,
    chHas: true,
    pgHas: true,
    totalsCalls: [] as boolean[],
    rangeRowsCalls: 0,
    /** purgeClickHouse가 끝나기 전에 부르는 훅(지우는 동안 끼어들기 시험) */
    duringPurge: null as (() => void) | null,
  };
  const stores: SensorStores = {
    totals: async (exact) => {
      st.totalsCalls.push(exact);
      return { ch: { ...st.ch }, pg: { ...st.pg } };
    },
    redisCounts: async () => ({ streamLength: 12, latestKeys: 31 }),
    purgeClickHouse: async () => {
      calls.push('ch');
      st.duringPurge?.();
      st.ch = { rows: 0, bytes: 0 };
    },
    purgePostgres: async () => {
      calls.push('pg');
      st.pg = { rows: 0, bytes: 0 };
    },
    purgeRedis: async () => {
      calls.push('redis');
      return { streamEntries: 12, keys: 40 };
    },
    lastIngest: async () => st.last,
    hasRows: async () => ({ clickhouse: st.chHas, postgres: st.pgHas }),
    rangeRows: async () => {
      st.rangeRowsCalls += 1;
      return { clickhouse: 700, postgres: 650 };
    },
  };
  return { stores, calls, st };
}

interface Opts {
  run?: boolean;
  plant?: boolean | 'error';
  running?: boolean | null;
  backlog?: number | null | 'error';
}

function service(opts: Opts = {}) {
  const f = fakeStores();
  let mono = 0;
  const lock = new SensorPurgeLock();
  const svc = new SensorDataService({
    stores: f.stores,
    runActive: () => opts.run === true,
    plantOn: async () => {
      if (opts.plant === 'error') throw new Error('redis down');
      return opts.plant === true;
    },
    plantRunning: () => (opts.running === undefined ? false : opts.running),
    backlog: async () => {
      if (opts.backlog === 'error') throw new Error('redis down');
      return opts.backlog === undefined ? 0 : opts.backlog;
    },
    lock,
    nowMs: () => Date.parse('2026-10-11T03:00:00Z'),
    monoMs: () => mono,
  });
  return { svc, lock, ...f, tick: (ms: number) => (mono += ms) };
}

describe('지우기 — 막는 이유 세 가지(r5 M4)', () => {
  it.each([
    ['실행 진행 중(먼저 본다)', { run: true, plant: true, backlog: 5 }, 'run_in_progress'],
    ['설비 가동 원하는 상태 on', { plant: true }, 'plant_running'],
    ['가동 상태를 읽지 못함 — 켜진 것으로 본다', { plant: 'error' as const }, 'plant_running'],
    ['키는 off지만 수집기가 아직 도는 중(끈 직후 ≤ 1초)', { running: true }, 'plant_running'],
    ['대기줄 적체(끈 직후 마지막 배치 · 앞 실행의 남은 적체)', { backlog: 3 }, 'stream_backlog'],
  ] as [string, Opts, string][])(
    '%s → 409 data.purge_blocked · 아무것도 지우지 않는다',
    async (_n, o, reason) => {
      const h = service(o);
      const e = await h.svc.purge().catch((x) => x);
      expect(e).toMatchObject({ code: 'data.purge_blocked', status: 409, details: { reason } });
      expect(h.calls).toEqual([]);
      // 막힌 뒤 잠금은 풀린다
      expect(h.lock.active).toBe(false);
    },
  );

  it('수집기가 없는 역할(null) · 적체를 읽지 못함(null · 오류)은 막지 않는다', async () => {
    for (const o of [{ running: null }, { backlog: null }, { backlog: 'error' as const }] as Opts[]) {
      const h = service(o);
      await h.svc.purge();
      expect(h.calls).toEqual(['ch', 'pg', 'redis']);
    }
  });

  it('설비 켜기가 진행 중이면 plant_running — 켜기와 지우기가 서로 지나치지 않는다', async () => {
    const h = service();
    let release: () => void = () => {};
    const turning = h.lock.turningPlantOn(() => new Promise<void>((r) => (release = r)));
    const e = await h.svc.purge().catch((x) => x);
    expect(e).toMatchObject({ code: 'data.purge_blocked', details: { reason: 'plant_running' } });
    release();
    await turning;
    await h.svc.purge();
    expect(h.calls).toEqual(['ch', 'pg', 'redis']);
  });
});

describe('지우는 동안 잠금 — 실행 시작 · 설비 켜기 거절(400 common.validation_failed · fields purge)', () => {
  it('TRUNCATE 도중 잠금이 서 있고 · 끝나면 풀린다', async () => {
    const h = service();
    const seen: unknown[] = [];
    h.st.duringPurge = () => {
      seen.push(h.lock.active);
      try {
        h.lock.assertIdle();
      } catch (e) {
        seen.push(e);
      }
    };
    let turnOn: unknown = null;
    const p = h.svc.purge();
    // 이유 확인(비동기) 중에도 잠금은 이미 서 있다 — 확인과 TRUNCATE 사이에 켜기가 끼어들지 못한다
    turnOn = await h.lock.turningPlantOn(async () => 'on').catch((x) => x);
    await p;
    expect(seen[0]).toBe(true);
    expect(seen[1]).toMatchObject({
      code: 'common.validation_failed',
      status: 400,
      details: { fields: [{ path: 'purge', reason: 'enum' }] },
    });
    expect(turnOn).toMatchObject({ code: 'common.validation_failed' });
    expect(h.lock.active).toBe(false);
    expect(await h.lock.turningPlantOn(async () => 'on')).toBe('on');
  });

  it('지우기가 실패해도 잠금은 풀린다', async () => {
    const h = service();
    h.stores.purgePostgres = async () => {
      throw new Error('pg down');
    };
    await expect(h.svc.purge()).rejects.toThrow('pg down');
    expect(h.lock.active).toBe(false);
  });
});

describe('지우기 — 순서 · 본문', () => {
  it('정확한 행 수를 먼저 센 뒤 ClickHouse → PostgreSQL → Redis · 본문은 SensorPurgeResult', async () => {
    const h = service();
    const r = SensorPurgeResult.parse(await h.svc.purge());
    expect(h.calls).toEqual(['ch', 'pg', 'redis']);
    expect(h.st.totalsCalls).toEqual([true]);
    expect(r.clickhouse.rows).toBe(1000);
    expect(r.postgres.rows).toBe(900);
    expect(r.redis).toMatchObject({ streamEntries: 12, keys: 40 });
  });

  it('겹친 요청은 지우기 하나를 나눠 받는다', async () => {
    const h = service();
    const [a, b] = await Promise.all([h.svc.purge(), h.svc.purge()]);
    expect(a).toBe(b);
    expect(h.calls).toEqual(['ch', 'pg', 'redis']);
  });
});

describe('현황 — 캐시 · 비교 구간 · 구간 행 수', () => {
  it('본문은 SensorDataStats · 캐시 창 안에서는 다시 세지 않는다 · 지우기 뒤에는 새로', async () => {
    const h = service();
    const a = SensorDataStats.parse(await h.svc.stats());
    expect(a.clickhouse).toEqual({ rows: 1000, bytes: 5000 });
    expect(a.redis).toEqual({ streamLength: 12, latestKeys: 31 });
    expect(a.compareRange).toEqual({ start: '2026-10-07T00:00:00.000Z', end: '2026-10-07T01:00:00.000Z' });
    // 구간 행 수는 넣기 verify가 센 값 — 다시 세지 않는다(원본 전체 1000과 다르다)
    expect(a.compareRows).toEqual({ clickhouse: 831_600, postgres: 831_600 });
    expect(h.st.rangeRowsCalls).toBe(0);
    h.tick(STATS_CACHE_MS - 1);
    await h.svc.stats();
    expect(h.st.totalsCalls).toEqual([false]);
    await h.svc.purge();
    const c = await h.svc.stats();
    expect(c.clickhouse.rows).toBe(0);
  });

  it('마지막 넣기 구간에 ClickHouse 행이 없으면(지운 뒤) · 넣기가 없으면 compareRange · compareRows null', async () => {
    const h = service();
    h.st.chHas = false;
    const a = await h.svc.stats();
    expect(a.compareRange).toBeNull();
    expect(a.compareRows).toBeNull();
    const h2 = service();
    h2.st.last = null;
    expect(await h2.svc.stats()).toMatchObject({ compareRange: null, compareRows: null });
  });

  it('마지막 넣기가 중단 · 실패면 그 전 완료 구간이 아니라 null(r5 M1)', async () => {
    for (const status of ['stopped', 'failed'] as const) {
      const h = service();
      h.st.last = {
        runId: '00000000-0000-4000-8000-000000000002',
        status,
        range: null,
        rows: null,
        published: null,
      };
      expect(await h.svc.stats()).toMatchObject({ compareRange: null, compareRows: null });
    }
  });

  it('PostgreSQL 구간이 비면(보존 만료 시차) postgres 0 · 옛 결과에 행 수가 없으면 그때만 센다', async () => {
    const h = service();
    h.st.pgHas = false;
    expect((await h.svc.stats()).compareRows).toEqual({ clickhouse: 831_600, postgres: 0 });
    const h2 = service();
    if (h2.st.last) h2.st.last.rows = null;
    expect((await h2.svc.stats()).compareRows).toEqual({ clickhouse: 700, postgres: 650 });
    expect(h2.st.rangeRowsCalls).toBe(1);
  });
});

describe('표면 — GET stats 200 · POST purge 200 · 409 에러 봉투 · JSON 본문 필수 · no-store', () => {
  let app: NestFastifyApplication;
  let plant = true;
  const f = fakeStores();
  const svc = new SensorDataService({
    stores: f.stores,
    runActive: () => false,
    plantOn: async () => plant,
    plantRunning: () => null,
    backlog: async () => 0,
    lock: new SensorPurgeLock(),
  });
  const call = (method: 'GET' | 'POST', url: string, opts: { payload?: string; type?: string } = {}) =>
    app
      .getHttpAdapter()
      .getInstance()
      .inject({
        method,
        url,
        ...(opts.payload === undefined ? {} : { payload: opts.payload }),
        ...(opts.type === undefined ? {} : { headers: { 'content-type': opts.type } }),
      });
  const json = { payload: '{}', type: 'application/json' };

  beforeAll(async () => {
    @Module({ controllers: [SensorDataController], providers: [{ provide: SENSOR_DATA, useValue: svc }] })
    class ProbeModule {}
    app = await NestFactory.create<NestFastifyApplication>(ProbeModule, new FastifyAdapter(), {
      logger: false,
    });
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/data/sensor/stats', async () => {
    const r = await call('GET', '/api/v1/data/sensor/stats');
    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    SensorDataStats.parse(r.json());
  });

  it('POST purge — 본문 없음 · text/plain · 폼 · 모르는 키는 400(아무것도 지우지 않는다)', async () => {
    plant = false;
    const cases = [
      { label: '본문 없음', opts: {}, path: 'header.content-type' },
      { label: 'text/plain', opts: { payload: '{}', type: 'text/plain' }, path: 'header.content-type' },
      { label: '모르는 키', opts: { payload: '{"x":1}', type: 'application/json' }, path: 'body.x' },
      { label: '배열', opts: { payload: '[]', type: 'application/json' }, path: 'body' },
    ];
    for (const c of cases) {
      const r = await call('POST', '/api/v1/data/sensor/purge', c.opts);
      expect(r.statusCode, c.label).toBe(400);
      const e = ErrorEnvelope.parse(r.json()).error;
      expect(e.code, c.label).toBe('common.validation_failed');
      expect(e.details, c.label).toMatchObject({ fields: [{ path: c.path }] });
    }
    // 폼 POST(다른 출처 폼이 보내는 모양) — 파서가 없어 415로 끝난다(지우지 않는다)
    const form = await call('POST', '/api/v1/data/sensor/purge', {
      payload: 'a=1',
      type: 'application/x-www-form-urlencoded',
    });
    expect(form.statusCode).toBeGreaterThanOrEqual(400);
    expect(f.calls).toEqual([]);
  });

  it('POST purge — 가동 중 409 · 끈 뒤 200', async () => {
    plant = true;
    const blocked = await call('POST', '/api/v1/data/sensor/purge', json);
    expect(blocked.statusCode).toBe(409);
    const e = ErrorEnvelope.parse(blocked.json()).error;
    expect(e.code).toBe('data.purge_blocked');
    expect(e.details).toEqual({ reason: 'plant_running' });
    plant = false;
    const ok = await call('POST', '/api/v1/data/sensor/purge', {
      payload: '{}',
      type: 'application/json; charset=utf-8',
    });
    expect(ok.statusCode).toBe(200);
    SensorPurgeResult.parse(ok.json());
  });
});
