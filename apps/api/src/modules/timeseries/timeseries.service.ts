// F-04 시계열 조회 — 판정 트리 정본 docs/06_pipeline/06_timeseries_read.md · 표면 07_api/05 #1
// S2 범위(TSQ-01 · 04): raw 고정 · 조회 캐시(SW-03). 해상도 자동 선택 · 상향 · 키 시간 스냅(SW-04) · 스탬피드 락(SW-05) · LTTB는 S4.
// 태그명 · 단위는 Dictionary(dict_tag · TSQ-07)가 조회 시점에 붙인다(S3) — PostgreSQL이 멈춰도 마지막 적재 값이 붙는다.
import { createHash } from 'node:crypto';
import {
  distinctTagIds,
  TIMESERIES_MAX_POINTS_DEFAULT,
  TIMESERIES_TAG_LIMIT,
  type TimeseriesQuery,
  type TimeseriesQueryBody,
} from '@db-study/shared';
import { Inject, Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { ApiError, validationFailed } from '../../common/http/api-error';
import { appRegistry, LATENCY_BUCKETS_SECONDS } from '../../common/metrics/registry';
import { TIMESERIES_CACHE_PORT, type TimeseriesCachePort } from './timeseries-cache.port';

/** TTL 구간 — 2계층 현행 참고(소유 06_pipeline/06 §TTL 구간 분류와 지터) */
export const RECENT_WINDOW_MS = 5 * 60_000;
export const TTL_CURRENT_BUCKET_S = 30;
export const TTL_PAST_S = 300;
/** raw의 스냅 단위 1분 — 현재 버킷 판정에 쓴다(해상도 표 raw 행) */
const RAW_BUCKET_MS = 60_000;
/** 예상 포인트 산정의 주기 — S2 시드 scan_rate_ms 1000(태그별 주기 조회는 S4 해상도 선택과 함께) */
const RAW_PERIOD_MS = 1000;

const reg = [appRegistry];
const cacheRequests = new Counter({
  name: 'tsq_cache_requests_total',
  help: 'cache:q 조회 결과 — 히트율은 이 계열만 쓴다',
  labelNames: ['result'],
  registers: reg,
});
const sourceQueries = new Counter({
  name: 'tsq_source_queries_total',
  help: '시계열 조회가 ClickHouse를 부른 수',
  registers: reg,
});
const rebuild = new Histogram({
  name: 'tsq_rebuild_duration_seconds',
  help: '캐시 미스 재구성 시간',
  buckets: LATENCY_BUCKETS_SECONDS,
  registers: reg,
});

type Freshness = 'recent' | 'current' | 'past';

/** 구간 분류 — 위에서부터 먼저 걸리는 것(06_pipeline/06 표) */
export function classify(toMs: number, nowMs: number): Freshness {
  if (toMs > nowMs - RECENT_WINDOW_MS) return 'recent';
  const currentBucketStart = Math.floor(nowMs / RAW_BUCKET_MS) * RAW_BUCKET_MS;
  return toMs >= currentBucketStart ? 'current' : 'past';
}

/** 정규화 키의 SHA-1 — 태그 정렬 · 기본값 제거(스냅 없음 — SW-04는 S4) · 접두 cache:q:는 래퍼가 붙인다 */
export function cacheKey(q: { tagIds: number[]; fromMs: number; toMs: number; maxPoints: number }): string {
  const norm = JSON.stringify({
    i: 'raw',
    t: [...q.tagIds].sort((a, b) => a - b),
    f: q.fromMs,
    to: q.toMs,
    ...(q.maxPoints !== TIMESERIES_MAX_POINTS_DEFAULT ? { m: q.maxPoints } : {}),
  });
  return createHash('sha1').update(norm).digest('hex');
}

@Injectable()
export class TimeseriesService {
  constructor(
    private readonly ch: ClickHouse,
    @Inject(TIMESERIES_CACHE_PORT) private readonly cache: TimeseriesCachePort,
  ) {}

  async query(q: TimeseriesQuery): Promise<TimeseriesQueryBody> {
    const tagIds = distinctTagIds(q.tagIds);
    if (tagIds.length > TIMESERIES_TAG_LIMIT) {
      throw new ApiError('timeseries.too_many_tags', `tagIds는 ${TIMESERIES_TAG_LIMIT}개 이하여야 한다`, {
        limit: TIMESERIES_TAG_LIMIT,
        received: tagIds.length,
      });
    }
    // S2는 raw 고정 — 다른 해상도 요청은 거절한다(롤업이 없다 · S4에서 해상도 선택으로 바뀐다)
    if (q.interval && q.interval !== 'raw')
      throw validationFailed([{ path: 'body.interval', reason: 'enum' }]);
    const fromMs = Date.parse(q.from);
    const toMs = Date.parse(q.to);
    const maxPoints = q.maxPoints ?? TIMESERIES_MAX_POINTS_DEFAULT;
    // S2 판정: 상향 · 다운샘플이 없어 태그당 예상 포인트가 maxPoints를 넘으면 거절한다 — 조용히 자르면 부분 결과가 전체로 읽힌다
    if ((toMs - fromMs) / RAW_PERIOD_MS > maxPoints)
      throw validationFailed([{ path: 'body.to', reason: 'range' }]);

    const now = Date.now();
    const freshness = classify(toMs, now);
    const key = cacheKey({ tagIds, fromMs, toMs, maxPoints });
    if (freshness !== 'recent') {
      const hit = await this.cache.get(key);
      if (hit.value) {
        cacheRequests.inc({ result: 'hit' });
        const body = JSON.parse(hit.value.toString('utf8')) as TimeseriesQueryBody;
        return { ...body, meta: { ...body.meta, cached: true } };
      }
      // 호출 실패(degrade)는 error — miss에 섞으면 히트율 분모가 Redis 장애만큼 부푼다(01_metrics §파생 지표)
      cacheRequests.inc({ result: hit.failed ? 'error' : 'miss' });
    }
    const endTimer = rebuild.startTimer();
    const body = await this.fromSource(tagIds, fromMs, toMs);
    endTimer();
    if (freshness !== 'recent') {
      const ttl = freshness === 'current' ? TTL_CURRENT_BUCKET_S : TTL_PAST_S;
      await this.cache.set(key, Buffer.from(JSON.stringify(body)), ttl);
    }
    return body;
  }

  /**
   * 메타 부착(TSQ-07 · 06_pipeline/06 §다운샘플 · 메타 부착) — 요청 태그 배열을 dictGet 한 번으로.
   * 사전에 없는 태그는 기본값 빈 문자열로 온다 — 이름 없는 태그가 조회에서 드러나는 자리다(07_cross_store_consistency).
   * 사전 조회 실패(생성 전 · 소스 불가로 한 번도 적재되지 않음)는 결과를 막지 않는다 — null로 낸다.
   */
  private async tagMeta(tagIds: number[]): Promise<Map<number, { name: string; unit: string }>> {
    try {
      const rs = await this.ch.client.query({
        query: `SELECT tag_id,
                       dictGet('plc.dict_tag', 'tag_name', toUInt64(tag_id)) AS name,
                       dictGet('plc.dict_tag', 'unit', toUInt64(tag_id))     AS unit
                  FROM (SELECT arrayJoin({tags:Array(UInt32)}) AS tag_id)`,
        query_params: { tags: tagIds },
        format: 'JSONEachRow',
      });
      const rows = await rs.json<{ tag_id: number; name: string; unit: string }>();
      return new Map(rows.map((r) => [Number(r.tag_id), { name: r.name, unit: r.unit }]));
    } catch {
      return new Map();
    }
  }

  private async fromSource(tagIds: number[], fromMs: number, toMs: number): Promise<TimeseriesQueryBody> {
    sourceQueries.inc();
    let rows: { tag_id: number; ts_ms: string; value: number; quality: number }[];
    try {
      const rs = await this.ch.client.query({
        // 파라미터 바인딩만 — 문자열 연결로 SQL을 만들지 않는다(REQ-GLB-24)
        query: `SELECT tag_id, toUnixTimestamp64Milli(ts) AS ts_ms, value, quality
                  FROM plc.tag_raw
                 WHERE tag_id IN {tags:Array(UInt32)}
                   AND ts >= fromUnixTimestamp64Milli({from:Int64}) AND ts < fromUnixTimestamp64Milli({to:Int64})
                 ORDER BY tag_id, ts_ms`,
        query_params: { tags: tagIds, from: fromMs, to: toMs },
        format: 'JSONEachRow',
      });
      rows = await rs.json();
    } catch {
      throw new ApiError('timeseries.clickhouse_unavailable', 'ClickHouse에 접속할 수 없다');
    }
    const meta = await this.tagMeta(tagIds);
    const byTag = new Map<number, number[][]>(tagIds.map((t) => [t, []]));
    for (const r of rows)
      byTag.get(Number(r.tag_id))?.push([Number(r.ts_ms), Number(r.value), Number(r.quality)]);
    return {
      meta: {
        interval: 'raw',
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
        columns: ['ts', 'value', 'quality'],
        pointCount: rows.length,
        downsampled: false,
        cached: false,
      },
      series: tagIds.map((tagId) => ({
        tagId,
        tagName: meta.get(tagId)?.name ?? null,
        unit: meta.get(tagId)?.unit ?? null,
        points: byTag.get(tagId) ?? [],
      })),
    };
  }
}
