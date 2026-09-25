// F-04 시계열 조회 — 판정 트리 정본 docs/06_pipeline/06_timeseries_read.md · 표면 07_api/05 #1
// S4: 해상도 자동 선택 · 상향(거절하지 않는다) · 버킷 스냅(SW-04) · 정규화 키 · TTL 3구간 · 스탬피드 락(SW-05) · 대기 소진 NX · LTTB · minmax.
// 거절은 셋뿐(태그 상한 · 형식 · ClickHouse 불가) — 상향 · 다운샘플 · 캐시 실패 · 락 실패 · 대기 소진은 보정이다(200).
// 태그명 · 단위는 Dictionary(dict_tag)가 조회 시점에 붙인다 — PostgreSQL이 멈춰도 마지막 적재 값이 붙는다(REQ-TSQ-08).
import {
  distinctTagIds,
  TIMESERIES_TAG_LIMIT,
  type TimeseriesQuery,
  type TimeseriesQueryBody,
} from '@db-study/shared';
import { Inject, Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { ApiError } from '../../common/http/api-error';
import { appRegistry, LATENCY_BUCKETS_SECONDS } from '../../common/metrics/registry';
import { WorkerPool } from '../../common/workers/worker-pool';
import type { ReduceResult, Row } from './downsample';
import {
  type Aggregation,
  type CacheKeyNormalizerPort,
  cacheKey,
  classify,
  type NormalizedQuery,
  normalize,
  ttlOf,
} from './resolution';
import {
  REBUILD_LOCK_PORT,
  REBUILD_WAIT_MS,
  REBUILD_WAIT_TRIES,
  type RebuildLockPort,
  TIMESERIES_CACHE_PORT,
  type TimeseriesCachePort,
} from './timeseries-cache.port';

export const KEY_NORMALIZER_PORT = Symbol('CacheKeyNormalizerPort');

const reg = [appRegistry];
const cacheRequests = new Counter({
  name: 'tsq_cache_requests_total',
  help: 'cache:q 조회 결과 — 히트율은 이 계열만 쓴다',
  labelNames: ['result'],
  registers: reg,
});
// 닫힌 레이블 값 0 초기화 — 첫 사건이 시계열에 처음 나타나며 increase()가 0을 내는 것을 막는다(기록 규칙 히트율 · S5)
for (const result of ['hit', 'miss', 'error']) cacheRequests.inc({ result }, 0);
const sourceQueries = new Counter({
  name: 'tsq_source_queries_total',
  help: '시계열 조회가 ClickHouse를 부른 수',
  registers: reg,
});
const rebuild = new Histogram({
  name: 'tsq_rebuild_duration_seconds',
  help: '캐시 미스 재구성 시간 — 스탬피드 대기 관계의 우변',
  buckets: LATENCY_BUCKETS_SECONDS,
  registers: reg,
});
const waitExhausted = new Counter({
  name: 'tsq_rebuild_lock_wait_exhausted_total',
  help: '스탬피드 대기 소진 → 직접 조회',
  registers: reg,
});

/** 집계 → 롤업 -Merge 식(REQ-TSQ-07 — 머지 전에는 같은 버킷의 부분 상태가 여러 행이다) */
const MERGE_EXPR: Record<Aggregation, string> = {
  avg: 'avgMerge(avg_v)',
  min: 'minMerge(min_v)',
  max: 'maxMerge(max_v)',
  last: 'argMaxMerge(last_v)',
  p95: 'arrayElement(quantilesTDigestMerge(0.95)(p95_v), 1)',
};
const ROLLUP_TABLE = { '1m': 'plc.tag_1m', '1h': 'plc.tag_1h', '1d': 'plc.tag_1d' } as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 저장 열(정렬 집계) → 응답 열(요청 순서 · minmax가 더한 min · max는 뒤에) */
export function responseColumns(n: NormalizedQuery, requested: readonly Aggregation[] | undefined): string[] {
  if (n.interval === 'raw') return ['ts', 'value', 'quality'];
  const order: string[] = [];
  for (const a of requested ?? ['avg']) if (!order.includes(a)) order.push(a);
  for (const a of n.aggregations) if (!order.includes(a)) order.push(a);
  return ['ts', ...order];
}

/**
 * 저장 모양 → 응답 모양 — 열은 요청 집계 순서로 · series는 요청 tagIds 순서로 다시 편다.
 * 캐시 키는 tagIds를 정렬해 만들므로 히트 본문의 series 순서는 첫 요청자의 순서다(검수 L3)
 */
export function reorder(
  body: TimeseriesQueryBody,
  cols: string[],
  tagOrder: readonly number[] = [],
): TimeseriesQueryBody {
  const from = body.meta.columns;
  const rank = new Map(tagOrder.map((id, i) => [id, i]));
  const series = tagOrder.length
    ? [...body.series].sort((a, b) => (rank.get(a.tagId) ?? 1e9) - (rank.get(b.tagId) ?? 1e9))
    : body.series;
  if (from.join() === cols.join()) return { ...body, series };
  const idx = cols.map((c) => from.indexOf(c));
  return {
    meta: { ...body.meta, columns: cols },
    series: series.map((s) => ({ ...s, points: s.points.map((p) => idx.map((i) => p[i] ?? null)) })),
  };
}

@Injectable()
export class TimeseriesService {
  constructor(
    private readonly ch: ClickHouse,
    private readonly workers: WorkerPool,
    @Inject(TIMESERIES_CACHE_PORT) private readonly cache: TimeseriesCachePort,
    @Inject(KEY_NORMALIZER_PORT) private readonly keys: CacheKeyNormalizerPort,
    @Inject(REBUILD_LOCK_PORT) private readonly lock: RebuildLockPort,
  ) {}

  async query(q: TimeseriesQuery): Promise<TimeseriesQueryBody> {
    const tagIds = distinctTagIds(q.tagIds);
    if (tagIds.length > TIMESERIES_TAG_LIMIT) {
      throw new ApiError('timeseries.too_many_tags', `tagIds는 ${TIMESERIES_TAG_LIMIT}개 이하여야 한다`, {
        limit: TIMESERIES_TAG_LIMIT,
        received: tagIds.length,
      });
    }
    const n = normalize(q, tagIds, this.keys);
    const cols = responseColumns(n, q.aggregations);
    const freshness = classify(n.toMs, Date.now(), n.interval);
    const ttl = ttlOf(freshness);
    // 최근 구간 — 캐시 없이 원천(계속 바뀌는 구간 · 최신값 · WebSocket으로 유도)
    if (ttl === null) return reorder(await this.rebuildTimed(n), cols, tagIds);

    const key = cacheKey(n);
    const hit = await this.readCache(key);
    if (hit) return reorder(hit, cols, tagIds);

    const acq = await this.lock.acquire(key);
    // off(NoopRebuildLock) · 락 호출 실패 — 락 없이 원천(스탬피드를 감수한다)
    if (acq.disabled || acq.failed) {
      const body = await this.rebuildTimed(n);
      await this.cache.set(key, Buffer.from(JSON.stringify(body)), ttl);
      return reorder(body, cols, tagIds);
    }
    if (acq.token) {
      try {
        const body = await this.rebuildTimed(n);
        await this.cache.set(key, Buffer.from(JSON.stringify(body)), ttl);
        return reorder(body, cols, tagIds);
      } finally {
        // ClickHouse 불가여도 즉시 해제 — 대기자가 만료 5초를 기다리지 않고 소진 경로에서 같은 503을 받는다
        await this.lock.release(key, acq.token);
      }
    }
    // 남이 쥐고 있다 — 간격마다 재조회 · 횟수 상한
    for (let i = 0; i < REBUILD_WAIT_TRIES; i++) {
      await sleep(REBUILD_WAIT_MS);
      const again = await this.readCache(key, false);
      if (again) return reorder(again, cols, tagIds);
    }
    // 대기 소진 — 락 없이 원천 · 선행 채움을 덮지 않는 쓰기(NX)
    waitExhausted.inc();
    const body = await this.rebuildTimed(n);
    await this.cache.setIfAbsent(key, Buffer.from(JSON.stringify(body)), ttl);
    return reorder(body, cols, tagIds);
  }

  /** 캐시 읽기 — 히트면 meta.cached 참. 첫 조회만 히트율 계열에 센다(대기 중 재조회는 같은 요청이다) */
  private async readCache(key: string, count = true): Promise<TimeseriesQueryBody | null> {
    const r = await this.cache.get(key);
    if (r.value) {
      if (count) cacheRequests.inc({ result: 'hit' });
      const body = JSON.parse(r.value.toString('utf8')) as TimeseriesQueryBody;
      return { ...body, meta: { ...body.meta, cached: true } };
    }
    // 호출 실패(degrade)는 error — miss에 섞으면 히트율 분모가 Redis 장애만큼 부푼다(01_metrics §파생 지표)
    if (count) cacheRequests.inc({ result: r.failed ? 'error' : 'miss' });
    return null;
  }

  private async rebuildTimed(n: NormalizedQuery): Promise<TimeseriesQueryBody> {
    const end = rebuild.startTimer();
    try {
      return await this.fromSource(n);
    } finally {
      end();
    }
  }

  /**
   * 메타(TSQ-07) — dictGet 한 번에 이름 · 단위 · 설비. 설비는 원시 · 롤업의 정렬 키 첫 칸(device_id)을 좁히는 데 쓴다.
   * 사전 조회 실패는 결과를 막지 않는다 — 메타 null · 설비 필터 없이 조회한다.
   */
  private async tagMeta(
    tagIds: number[],
  ): Promise<Map<number, { name: string; unit: string; deviceId: number }>> {
    try {
      const rs = await this.ch.client.query({
        query: `SELECT tag_id,
                       dictGet('plc.dict_tag', 'tag_name', toUInt64(tag_id))  AS name,
                       dictGet('plc.dict_tag', 'unit', toUInt64(tag_id))      AS unit,
                       dictGet('plc.dict_tag', 'device_id', toUInt64(tag_id)) AS device_id
                  FROM (SELECT arrayJoin({tags:Array(UInt32)}) AS tag_id)`,
        query_params: { tags: tagIds },
        format: 'JSONEachRow',
      });
      const rows = await rs.json<{ tag_id: number; name: string; unit: string; device_id: number }>();
      return new Map(
        rows.map((r) => [Number(r.tag_id), { name: r.name, unit: r.unit, deviceId: Number(r.device_id) }]),
      );
    } catch {
      return new Map();
    }
  }

  private async fromSource(n: NormalizedQuery): Promise<TimeseriesQueryBody> {
    sourceQueries.inc();
    const meta = await this.tagMeta(n.tagIds);
    const devices = [...new Set(n.tagIds.map((t) => meta.get(t)?.deviceId ?? 0))];
    // 사전에 없는 태그가 하나라도 있으면 설비 필터를 걸지 않는다 — 걸면 그 태그의 행이 조용히 빠진다
    const deviceFilter = devices.includes(0) ? '' : 'device_id IN {devs:Array(UInt32)} AND';
    const columns = n.interval === 'raw' ? ['ts', 'value', 'quality'] : ['ts', ...n.aggregations];
    const query =
      n.interval === 'raw'
        ? `SELECT tag_id, toUnixTimestamp64Milli(ts) AS ts_ms, value, quality
             FROM plc.tag_raw
            WHERE ${deviceFilter} tag_id IN {tags:Array(UInt32)}
              AND ts >= fromUnixTimestamp64Milli({from:Int64}) AND ts < fromUnixTimestamp64Milli({to:Int64})
            ORDER BY tag_id, ts_ms`
        : `SELECT tag_id, toUnixTimestamp(bucket) * 1000 AS ts_ms,
                  ${n.aggregations.map((a) => `${MERGE_EXPR[a]} AS ${a}`).join(', ')}
             FROM ${ROLLUP_TABLE[n.interval]}
            WHERE ${deviceFilter} tag_id IN {tags:Array(UInt32)}
              AND bucket >= toDateTime(intDiv({from:Int64}, 1000)) AND bucket < toDateTime(intDiv({to:Int64}, 1000))
            GROUP BY tag_id, bucket
            ORDER BY tag_id, bucket`;
    let rows: Record<string, number | string | null>[];
    try {
      const rs = await this.ch.client.query({
        // 파라미터 바인딩만 — 집계 식 · 테이블은 고정 목록에서 고른다(사용자 입력이 SQL 문자열이 되지 않는다 · REQ-GLB-24)
        query,
        query_params: { tags: n.tagIds, devs: devices, from: n.fromMs, to: n.toMs },
        format: 'JSONEachRow',
      });
      rows = await rs.json();
    } catch {
      throw new ApiError('timeseries.clickhouse_unavailable', 'ClickHouse에 접속할 수 없다');
    }
    const byTag = new Map<number, Row[]>(n.tagIds.map((t) => [t, []]));
    const valueCols = columns.slice(1);
    for (const r of rows) {
      const row: Row = [Number(r.ts_ms)];
      for (const c of valueCols) {
        const v = r[c];
        row.push(v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
      }
      byTag.get(Number(r.tag_id))?.push(row);
    }
    let series = n.tagIds.map((t) => byTag.get(t) ?? []);
    let downsampled = false;
    if (series.some((s) => s.length > n.maxPoints)) {
      const r = await this.workers.run<ReduceResult>(
        { series, maxPoints: n.maxPoints, mode: n.downsample, columns },
        'reduce',
      );
      series = r.series;
      downsampled = r.downsampled;
    }
    return {
      meta: {
        interval: n.interval,
        from: new Date(n.fromMs).toISOString(),
        to: new Date(n.toMs).toISOString(),
        columns,
        pointCount: series.reduce((a, s) => a + s.length, 0),
        downsampled,
        cached: false,
      },
      series: n.tagIds.map((tagId, i) => ({
        tagId,
        tagName: meta.get(tagId)?.name ?? null,
        unit: meta.get(tagId)?.unit ?? null,
        points: series[i] ?? [],
      })),
    };
  }
}
