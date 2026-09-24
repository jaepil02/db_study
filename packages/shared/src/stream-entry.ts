// Stream 엔트리 계약 v1 — 정본 docs/06_pipeline/12_data_contract.md §3단계 — Stream 엔트리
// 엔트리 하나 = 설비 하나의 스캔 사이클 하나(생성 모드는 설비 하나의 시점 하나). 8필드 · 스칼라 4 + 배열 4.
import { z } from 'zod';
import { STREAM_QUALITY_CODES } from './enums';

export const STREAM_SCHEMA_VERSION = 1 as const;
const INT32_MAX = 2_147_483_647;
const UINT32_MAX = 4_294_967_295;

const uint32 = z.number().int().min(0).max(UINT32_MAX);
/** epoch ms · scan_seq — 계약은 uint64이며 JS 안전 정수 범위 안에서 다룬다 */
const uint64Safe = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const StreamEntryV1 = z
  .object({
    v: z.literal(STREAM_SCHEMA_VERSION),
    d: uint32,
    s: uint64Safe,
    t0: uint64Safe,
    tg: z.array(uint32),
    dt: z.array(z.number().int().min(0).max(INT32_MAX)),
    va: z.array(
      z
        .number()
        .refine(Number.isFinite, '유한 값이어야 한다 — NaN · 무한대는 발행 전에 BAD_RANGE로 판정된다'),
    ),
    q: z.array(
      z
        .number()
        .int()
        .refine((c) => STREAM_QUALITY_CODES.includes(c), '품질 0 · 1 · 2 · 4 · 9 중 하나'),
    ),
  })
  .strict()
  .superRefine((e, ctx) => {
    const n = e.tg.length;
    if (e.dt.length !== n || e.va.length !== n || e.q.length !== n) {
      ctx.addIssue({ code: 'custom', message: 'tg · dt · va · q 길이가 같아야 한다' });
      return;
    }
    // t0 = 엔트리 안 ts의 최솟값 → 비어 있지 않으면 min(dt) = 0
    if (n > 0 && Math.min(...e.dt) !== 0) {
      ctx.addIssue({ code: 'custom', message: 't0는 엔트리 안 ts의 최솟값이어야 한다 — min(dt) = 0' });
    }
  });

export type StreamEntry = z.infer<typeof StreamEntryV1>;

/**
 * 소비자(Ingest)용 — 발행자 결함을 적재 유실로 바꾸지 않는다: 음수 dt · t0가 최솟값이 아닌 엔트리를
 * 거절하지 않고 받아 계수한다(06_pipeline/12 §3단계 · ing_negative_dt_total). 모양(8필드 · 길이 · 타입)은 같이 막는다.
 * 발행자(생성기 · Collector)는 StreamEntryV1로 검증한다.
 */
export const StreamEntryV1Consumer = z
  .object({
    v: z.literal(STREAM_SCHEMA_VERSION),
    d: uint32,
    s: uint64Safe,
    t0: uint64Safe,
    tg: z.array(uint32),
    dt: z.array(
      z
        .number()
        .int()
        .min(-INT32_MAX - 1)
        .max(INT32_MAX),
    ),
    va: z.array(z.number().refine(Number.isFinite)),
    q: z.array(
      z
        .number()
        .int()
        .refine((c) => STREAM_QUALITY_CODES.includes(c)),
    ),
  })
  .strict()
  .refine((e) => e.dt.length === e.tg.length && e.va.length === e.tg.length && e.q.length === e.tg.length, {
    message: 'tg · dt · va · q 길이가 같아야 한다',
  });

/** ts[i] = t0 + dt[i] */
export function entryTimestamps(e: Pick<StreamEntry, 't0' | 'dt'>): number[] {
  return e.dt.map((d) => e.t0 + d);
}
