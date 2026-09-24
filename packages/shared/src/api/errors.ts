// 에러 코드 · 봉투 — 코드 정본 docs/11_glossary/02_error_codes.md §에러 코드 전수 · 봉투 정본 docs/07_api/01_conventions.md §에러 봉투
// 클라이언트는 code로만 분기한다. HTTP 상태는 code가 정한다(한 code = 한 상태).
import { z } from 'zod';

/** 에러 코드 22 → HTTP 상태 */
export const ERROR_HTTP_STATUS = {
  'common.validation_failed': 400,
  'common.not_found': 404,
  'common.duplicate_key': 409,
  'common.rate_limited': 429,
  'common.postgres_unavailable': 503,
  'auth.invalid_credentials': 401,
  'auth.unauthenticated': 401,
  'auth.token_expired': 401,
  'auth.refresh_invalid': 401,
  'auth.token_store_unavailable': 503,
  'auth.forbidden': 403,
  'master.scale_change_forbidden': 409,
  'master.reissue_source_inactive': 409,
  'timeseries.clickhouse_unavailable': 503,
  'timeseries.too_many_tags': 400,
  'realtime.latest_unavailable': 503,
  'alarms.ack_not_allowed': 409,
  'alarms.eval_store_unavailable': 503,
  'work_orders.invalid_status_transition': 409,
  'work_orders.production_log_not_allowed': 409,
  'datagen.stream_full': 503,
  'datagen.bulk_disabled': 404,
} as const;
export type ErrorCode = keyof typeof ERROR_HTTP_STATUS;

/** common.validation_failed의 reason 값 8(07_api/01 §에러 봉투) */
export const VALIDATION_REASONS = [
  'required',
  'type',
  'enum',
  'range',
  'format',
  'unknown',
  'immutable',
  'reference',
] as const;
export type ValidationReason = (typeof VALIDATION_REASONS)[number];

export interface ValidationFieldIssue {
  path: string;
  reason: ValidationReason;
}

export const ErrorEnvelope = z.strictObject({
  error: z.strictObject({
    code: z.string().optional(), // 500은 code를 싣지 않는다 — 결함이지 설계된 실패가 아니다
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorEnvelopeBody = z.infer<typeof ErrorEnvelope>;
