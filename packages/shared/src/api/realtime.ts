// 최신값 표면 — 정본 docs/07_api/06_realtime.md #1 GET /api/v1/realtime/devices/{id}/tags
// 시각: ts = epoch ms(측정 시각) · servedAt = UTC ISO(STALE 판정에 쓴 서버 현재) — 07_api/01 §시각 직렬화
import { z } from 'zod';

export const LatestSource = z.enum(['redis', 'restored', 'clickhouse']);

export const LatestItem = z.strictObject({
  tagId: z.number().int(),
  tagCode: z.string().nullable(),
  tagName: z.string().nullable(),
  unit: z.string().nullable(),
  ts: z.number().int(),
  value: z.number(),
  quality: z.number().int(),
  /** scan_rate_ms × 배수 — 메타가 비면 null(판정 불가 표지) */
  staleAfterMs: z.number().int().nullable(),
});
export type LatestItemBody = z.infer<typeof LatestItem>;

export const LatestDeviceResponse = z.strictObject({
  meta: z.strictObject({
    deviceId: z.number().int(),
    servedAt: z.iso.datetime(),
    source: LatestSource,
    restored: z.boolean(),
    metaMissing: z.number().int().min(0),
  }),
  /** 빈 목록 = 설비는 있으나 측정값이 아직 없다 */
  items: z.array(LatestItem),
});
export type LatestDeviceBody = z.infer<typeof LatestDeviceResponse>;

/** 경로 식별자 — 정수 ID(07_api/01 §표면 계층과 경로) */
export const DeviceIdParam = z.coerce.number().int().min(1).max(4_294_967_295);
