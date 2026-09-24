// 설계된 실패 = 에러 코드 하나 — 봉투 정본 docs/07_api/01_conventions.md §에러 봉투 · 코드 정본 11_glossary/02
// 클라이언트는 code로만 분기하고, HTTP 상태는 code가 정한다.
import {
  ERROR_HTTP_STATUS,
  type ErrorCode,
  type ValidationFieldIssue,
  type ValidationReason,
} from '@db-study/shared';
import type { z } from 'zod';

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.status = ERROR_HTTP_STATUS[code];
  }
}

/** 요청 위치 접두 — fields.path가 "body.tagIds.0" · "path.id" · "header.host" 모양이 된다 */
export type RequestPart = 'body' | 'query' | 'path' | 'header';

function reasonOf(issue: z.core.$ZodIssue): ValidationReason {
  switch (issue.code) {
    case 'invalid_type':
      return (issue as { input?: unknown }).input === undefined ? 'required' : 'type';
    case 'unrecognized_keys':
      return 'unknown';
    case 'invalid_value':
      return 'enum';
    case 'too_small':
    case 'too_big':
      return 'range';
    case 'invalid_format':
      return 'format';
    default:
      return 'range';
  }
}

export function validationFailed(fields: ValidationFieldIssue[]): ApiError {
  return new ApiError('common.validation_failed', '요청이 계약을 어긴다', { fields });
}

/** 스키마 검증 — 위반은 common.validation_failed/400(07_api/01 §요청 검증과 성공 본문) */
export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown, part: RequestPart): z.infer<S> {
  const r = schema.safeParse(value);
  if (r.success) return r.data;
  const fields: ValidationFieldIssue[] = r.error.issues.flatMap((i) => {
    if (i.code === 'unrecognized_keys') {
      return i.keys.map((k) => ({
        path: [part, ...i.path.map(String), k].join('.'),
        reason: 'unknown' as const,
      }));
    }
    return [{ path: [part, ...i.path.map(String)].join('.'), reason: reasonOf(i) }];
  });
  throw validationFailed(fields);
}
