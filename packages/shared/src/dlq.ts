// DLQ 엔트리 계약 — 정본 docs/06_pipeline/12_data_contract.md §DLQ 엔트리 · 05_data_stores/05 stream:plc:dlq 행
// 엔트리 하나 = 실패한 원 엔트리 하나(배치 통째가 아니다) · 필드 4 — 원 본문 · 원 ID · 사유 · 원 배치 토큰(재시도 소진만)
import { z } from 'zod';

export const STREAM_DLQ = 'stream:plc:dlq';

/** XADD 필드 이름 — 원 본문은 raw와 같은 p(바이트 그대로) */
export const DLQ_FIELDS = { payload: 'p', originId: 'oid', reason: 'reason', batchToken: 'token' } as const;

/** 사유 — dlq_count{reason} 레이블과 같은 값(10_observability/01) · 그 밖(other)은 레이블에 싣지 않는다 */
export const DLQ_REASONS = ['undecodable', 'retry_exhausted'] as const;
export type DlqReason = (typeof DLQ_REASONS)[number];

export const DlqEntryMeta = z.strictObject({
  originId: z.string().regex(/^\d+-\d+$/),
  reason: z.enum(DLQ_REASONS),
  /** 재시도 소진 사유일 때만 — 해독 불가는 배치에 들기 전에 격리되어 토큰이 없다 */
  batchToken: z
    .string()
    .regex(/^[0-9a-f]{40}$/)
    .nullable(),
});
export type DlqEntryMetaBody = z.infer<typeof DlqEntryMeta>;
