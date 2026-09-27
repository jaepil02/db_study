// 흐름 이벤트 계약 — 정본 docs/07_api/11_websocket.md §흐름 이벤트 — flow(ch:flow 페이로드 · flow 프레임)
// 값(측정값 · 업무 행 · payload)은 싣지 않는다 — 개수 · 시간 · 종류 · 결과 코드만. 시각은 발행자 시계 epoch ms.
import { z } from 'zod';

export const FLOW_CHANNEL = 'ch:flow';
/** 구독 중 표지 — 캐시 계열 · TTL 15초 · 게이트웨이 5초마다 갱신 · 발행자 확인 간격 5초 */
export const FLOW_SUBSCRIBED_KEY = 'cache:flow:subscribed';
export const FLOW_MARKER_TTL_S = 15;
export const FLOW_MARKER_REFRESH_MS = 5_000;
export const FLOW_MARKER_CHECK_MS = 5_000;
/** 연결마다 병합 창 250 ms(초당 최대 4) · 창 안 최신 배치 8 · 업무 20 */
export const FLOW_WINDOW_MS = 250;
export const FLOW_MAX_BATCHES = 8;
export const FLOW_MAX_BIZ = 20;

export const FLOW_ROLES = ['ingest', 'biz-writer', 'api-direct'] as const;
export type FlowRole = (typeof FLOW_ROLES)[number];

const ms = z.number().nonnegative().nullable();
const int = z.number().int().nonnegative();

export const FlowIngestTotals = z.strictObject({
  batches: int,
  rows: int,
  chRows: int,
  dlqEntries: int,
  controlCopyRows: int,
  judgedRows: int,
  opened: int,
  closed: int,
  latestWrites: int,
});
export const FlowBizTotals = z.strictObject({
  commands: int,
  applied: int,
  rejected: int,
  expired: int,
  failed: int,
  duplicates: int,
});

/** 배치 요약(프레임 안 모양 — totals · startedAt 제외) */
export const FlowBatchSummary = z.strictObject({
  event: z.literal('batch'),
  source: z.string(),
  role: z.literal('ingest'),
  seq: int,
  at: z.number().int(),
  rows: int,
  stages: z.strictObject({
    streamWaitMs: ms,
    decodeMs: ms,
    chInsertMs: ms,
    controlCopyMs: ms,
    latestWriteMs: ms,
    alarmMs: ms,
  }),
  chRows: int,
  retries: int,
  dlqEntries: int,
  controlCopy: z.strictObject({ rows: int, ok: z.boolean() }).nullable(),
  latestWrites: int.nullable(),
  alarm: z.strictObject({ judgedRows: int, opened: int, closed: int }).nullable(),
  stream: z.strictObject({ length: int, lag: int.nullable() }).nullable(),
});
export type FlowBatchSummaryBody = z.infer<typeof FlowBatchSummary>;

/** 업무 명령 요약 — result는 'ok' · 오류 코드 · 'expired' */
export const FlowBizSummary = z.strictObject({
  event: z.literal('biz'),
  source: z.string(),
  role: z.enum(['biz-writer', 'api-direct']),
  seq: int,
  at: z.number().int(),
  cmdId: z.uuid().nullable(),
  kind: z.string(),
  result: z.string(),
  duplicate: z.boolean(),
  stages: z.strictObject({ queueWaitMs: ms, txMs: ms, invalidateMs: ms, replyMs: ms }),
  invalidatedKeys: int,
  cacheinv: z.boolean(),
});
export type FlowBizSummaryBody = z.infer<typeof FlowBizSummary>;

/** ch:flow 메시지 — 요약 + startedAt · totals */
export const FlowChannelMessage = z.discriminatedUnion('event', [
  FlowBatchSummary.extend({ startedAt: z.number().int(), totals: FlowIngestTotals }),
  FlowBizSummary.extend({ startedAt: z.number().int(), totals: FlowBizTotals }),
]);
export type FlowChannelMessageBody = z.infer<typeof FlowChannelMessage>;

/** 프레임 totals 항목 — (source · role)마다 창 안 마지막 값 */
export const FlowTotalsEntry = z.union([
  z.strictObject({
    source: z.string(),
    role: z.literal('ingest'),
    startedAt: z.number().int(),
    ...FlowIngestTotals.shape,
  }),
  z.strictObject({
    source: z.string(),
    role: z.enum(['biz-writer', 'api-direct']),
    startedAt: z.number().int(),
    ...FlowBizTotals.shape,
  }),
]);
export type FlowTotalsEntryBody = z.infer<typeof FlowTotalsEntry>;

/** 서버 → 클라이언트 flow 프레임 — 필드 6 */
export const FlowFrame = z.strictObject({
  type: z.literal('flow'),
  windowEnd: z.number().int(),
  batches: z.array(FlowBatchSummary),
  biz: z.array(FlowBizSummary),
  dropped: z.strictObject({ batches: int, biz: int }),
  totals: z.array(FlowTotalsEntry),
});
export type FlowFrameBody = z.infer<typeof FlowFrame>;
