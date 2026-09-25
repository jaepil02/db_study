// 해상도 선택 · 상향 · 버킷 스냅 · 정규화 키 · TTL 구간 — 정본 docs/06_pipeline/06_timeseries_read.md
// 해상도 경계(1시간 · 7일 · 90일)는 1계층 구조값(정본 11_glossary/03) · TTL · 최근 창은 2계층 현행 참고(소유 06_pipeline/06).
import { createHash } from 'node:crypto';
import {
  AGGREGATIONS,
  INTERVALS,
  TIMESERIES_MAX_POINTS_DEFAULT,
  type TimeseriesQuery,
} from '@db-study/shared';

export type Interval = (typeof INTERVALS)[number];
export type Aggregation = (typeof AGGREGATIONS)[number];

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** KST = UTC+9 — 1d 버킷은 KST 자정이다(05_data_stores/04 §일 경계 시간대 판정). 문자열 날짜로 내리지 않는다 */
const KST_OFFSET_MS = 9 * HOUR;

/** 해상도별 버킷 폭 — raw는 스냅 단위 1분(해상도 표 raw 행) */
export const BUCKET_MS: Record<Interval, number> = { raw: MIN, '1m': MIN, '1h': HOUR, '1d': DAY };
const LADDER: Interval[] = ['raw', '1m', '1h', '1d'];

/**
 * raw 예상 포인트의 주기 — S4 판정: 1,000 ms(티어 S · M 시드 주기). 태그별 scan_rate_ms를 읽으려면 PostgreSQL이 필요해
 * "PostgreSQL이 멈춰도 조회는 계속"(REQ-TSQ-08)이 깨진다. M+ · L(100 ms)에서는 raw가 과소 추정되어 2차 축소(LTTB)가 받는다.
 */
export const RAW_PERIOD_MS = 1000;

/** TTL 구간 — 2계층 현행 참고 */
export const RECENT_WINDOW_MS = 5 * MIN;
export const TTL_CURRENT_BUCKET_S = 30;
export const TTL_PAST_S = 300;

/** 범위 길이로 고른다 — 1시간 이하 raw · 7일까지 1m · 90일까지 1h · 초과 1d */
export function chooseInterval(rangeMs: number): Interval {
  if (rangeMs <= HOUR) return 'raw';
  if (rangeMs <= 7 * DAY) return '1m';
  if (rangeMs <= 90 * DAY) return '1h';
  return '1d';
}

/** 태그당 예상 포인트 */
export function expectedPoints(interval: Interval, rangeMs: number): number {
  return Math.ceil(rangeMs / (interval === 'raw' ? RAW_PERIOD_MS : BUCKET_MS[interval]));
}

/** 예상 포인트가 maxPoints를 넘으면 한 단계씩 올린다 — 거절하지 않는다(raw 지정도 같다 · REQ-TSQ-04) */
export function resolveInterval(
  requested: Interval | undefined,
  rangeMs: number,
  maxPoints: number,
): Interval {
  let i = LADDER.indexOf(requested ?? chooseInterval(rangeMs));
  while (i < LADDER.length - 1 && expectedPoints(LADDER[i] as Interval, rangeMs) > maxPoints) i++;
  return LADDER[i] as Interval;
}

/** 버킷 경계 내림 — epoch 연산 · 1d는 KST 자정 */
export function floorToBucket(ms: number, interval: Interval): number {
  const b = BUCKET_MS[interval];
  if (interval === '1d') return Math.floor((ms + KST_OFFSET_MS) / b) * b - KST_OFFSET_MS;
  return Math.floor(ms / b) * b;
}

/** SW-04 CacheKeyNormalizerPort — 스냅한 범위가 곧 조회 범위다(히트 · 미스가 같은 범위의 결과를 낸다) */
export interface CacheKeyNormalizerPort {
  readonly implName: 'TimeSnapKeyNormalizer' | 'RawTimeKeyNormalizer';
  range(interval: Interval, fromMs: number, toMs: number): { fromMs: number; toMs: number };
}

export class TimeSnapKeyNormalizer implements CacheKeyNormalizerPort {
  readonly implName = 'TimeSnapKeyNormalizer' as const;
  range(interval: Interval, fromMs: number, toMs: number) {
    const f = floorToBucket(fromMs, interval);
    let t = floorToBucket(toMs, interval);
    // 버킷 하나보다 짧은 범위는 내림으로 비지 않게 버킷 하나로 둔다
    if (t <= f) t = f + BUCKET_MS[interval];
    return { fromMs: f, toMs: t };
  }
}

/** SW-04 off — 요청 시각 그대로(초 단위 now()가 키에 들어가 매 요청이 다른 키 · 히트율 0 수렴) */
export class RawTimeKeyNormalizer implements CacheKeyNormalizerPort {
  readonly implName = 'RawTimeKeyNormalizer' as const;
  range(_interval: Interval, fromMs: number, toMs: number) {
    return { fromMs, toMs };
  }
}

/** 캐시 저장 열 순서 — 집계는 정렬해 한 키로 묶고, 응답 때 요청 순서로 다시 편다(06_pipeline/06 §캐시 키 정규화 단계 3) */
export function canonicalAggregations(
  aggs: readonly Aggregation[],
  downsample: 'lttb' | 'minmax',
  interval: Interval,
) {
  const set = new Set(aggs);
  if (downsample === 'minmax' && interval !== 'raw') {
    set.add('min');
    set.add('max');
  }
  return AGGREGATIONS.filter((a) => set.has(a));
}

export interface NormalizedQuery {
  interval: Interval;
  tagIds: number[];
  fromMs: number;
  toMs: number;
  aggregations: Aggregation[];
  maxPoints: number;
  downsample: 'lttb' | 'minmax';
}

/** 정규화 문자열의 SHA-1 40자 — 기본값(avg · 2000 · lttb)은 뺀다 · 해상도는 선택 · 상향 뒤 값 */
export function cacheKey(n: NormalizedQuery): string {
  const aggs = [...n.aggregations].sort();
  const norm = JSON.stringify({
    i: n.interval,
    t: [...n.tagIds].sort((a, b) => a - b),
    f: n.fromMs,
    to: n.toMs,
    ...(aggs.length === 1 && aggs[0] === 'avg' ? {} : { a: aggs }),
    ...(n.maxPoints !== TIMESERIES_MAX_POINTS_DEFAULT ? { m: n.maxPoints } : {}),
    ...(n.downsample !== 'lttb' ? { d: n.downsample } : {}),
  });
  return createHash('sha1').update(norm).digest('hex');
}

export type Freshness = 'recent' | 'current' | 'past';

/** 구간 분류 — 위에서부터 먼저 걸리는 것 · 현재 버킷은 선택된 해상도의 버킷(api 서버 시계) */
export function classify(toMs: number, nowMs: number, interval: Interval = 'raw'): Freshness {
  if (toMs > nowMs - RECENT_WINDOW_MS) return 'recent';
  return toMs >= floorToBucket(nowMs, interval) ? 'current' : 'past';
}

export function ttlOf(f: Freshness): number | null {
  return f === 'recent' ? null : f === 'current' ? TTL_CURRENT_BUCKET_S : TTL_PAST_S;
}

/** 요청 → 정규화(해상도 · 스냅 · 기본값) */
export function normalize(
  q: TimeseriesQuery,
  tagIds: number[],
  snap: CacheKeyNormalizerPort,
): NormalizedQuery {
  const maxPoints = q.maxPoints ?? TIMESERIES_MAX_POINTS_DEFAULT;
  const downsample = q.downsample ?? 'lttb';
  const fromReq = Date.parse(q.from);
  const toReq = Date.parse(q.to);
  const interval = resolveInterval(q.interval, toReq - fromReq, maxPoints);
  const { fromMs, toMs } = snap.range(interval, fromReq, toReq);
  const aggregations = canonicalAggregations(q.aggregations ?? ['avg'], downsample, interval);
  return { interval, tagIds, fromMs, toMs, aggregations, maxPoints, downsample };
}
