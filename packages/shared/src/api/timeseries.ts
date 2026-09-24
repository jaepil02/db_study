// 시계열 조회 표면 — 정본 docs/07_api/05_timeseries.md #1 POST /api/v1/timeseries/query
// 요청 6필드 · 모르는 필드 거절 · 시각은 오프셋 포함 ISO 8601만(07_api/01 §시각 직렬화)
// 태그 배열 상한(현행 참고 50)과 최대 포인트 기본값(현행 참고 2000)은 07_api/05가 소유하는 2계층 조정값이다.
import { z } from 'zod';

export const TIMESERIES_TAG_LIMIT = 50;
export const TIMESERIES_MAX_POINTS_DEFAULT = 2000;

export const INTERVALS = ['raw', '1m', '1h', '1d'] as const;
export const AGGREGATIONS = ['avg', 'min', 'max', 'last', 'p95'] as const;
export const DOWNSAMPLE_MODES = ['lttb', 'minmax'] as const;

const offsetIso = z.iso.datetime({ offset: true });

/** 태그 수 상한은 스키마 밖에서 센다 — 초과는 validation_failed가 아니라 timeseries.too_many_tags다 */
export const TimeseriesQueryRequest = z
  .strictObject({
    tagIds: z.array(z.number().int().min(1).max(4_294_967_295)).min(1),
    from: offsetIso,
    to: offsetIso,
    interval: z.enum(INTERVALS).optional(),
    aggregations: z.array(z.enum(AGGREGATIONS)).min(1).optional(),
    maxPoints: z.number().int().min(1).optional(),
    downsample: z.enum(DOWNSAMPLE_MODES).optional(),
  })
  .refine((r) => Date.parse(r.from) < Date.parse(r.to), { message: 'from < to', path: ['from'] });
export type TimeseriesQuery = z.infer<typeof TimeseriesQueryRequest>;

/** 중복 제거 뒤 태그 수 — 상한 판정의 기준(07_api/05 §요청) */
export function distinctTagIds(tagIds: readonly number[]): number[] {
  return [...new Set(tagIds)];
}

export const TimeseriesSeries = z.strictObject({
  tagId: z.number().int(),
  tagName: z.string().nullable(),
  unit: z.string().nullable(),
  /** 배열의 배열 — 열 위치는 meta.columns 순서 · 첫 열 ts(epoch ms) */
  points: z.array(z.array(z.number().nullable())),
});

export const TimeseriesQueryResponse = z.strictObject({
  meta: z.strictObject({
    interval: z.enum(INTERVALS),
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    columns: z.array(z.string()),
    pointCount: z.number().int().min(0),
    downsampled: z.boolean(),
    cached: z.boolean(),
  }),
  series: z.array(TimeseriesSeries),
});
export type TimeseriesQueryBody = z.infer<typeof TimeseriesQueryResponse>;
