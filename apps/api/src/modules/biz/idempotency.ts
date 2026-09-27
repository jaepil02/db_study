// 업무 쓰기 표면의 명령 ID · 응답 조립 — 표면 정본 docs/07_api/01_conventions.md §업무 쓰기 경로 · §멱등
// 요청 헤더 Idempotency-Key(UUID · 선택): UUID가 아니면 common.validation_failed/400(header.idempotency-key · format).
// 응답은 같은 헤더로 명령 ID를 되싣는다(202 · 거절 · 503 포함) — SW-12 direct는 형식 검사만 하고 되싣지 않는다.
import { type BizKind, type CommandAcceptedBody, IDEMPOTENCY_HEADER } from '@db-study/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { ApiError, validationFailed } from '../../common/http/api-error';
import type { BizWriteOutcome, BizWritePort } from './biz-contracts';

const UUID = z.uuid();

/** 헤더 값 → 명령 ID(없으면 null) · 형식 위반 400 */
export function idempotencyKeyOf(req: FastifyRequest): string | null {
  const raw = req.headers[IDEMPOTENCY_HEADER];
  if (raw === undefined) return null;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === undefined || !UUID.safeParse(v).success) {
    throw validationFailed([{ path: `header.${IDEMPOTENCY_HEADER}`, reason: 'format' }]);
  }
  return v.toLowerCase();
}

/** 요청자 user_id — 인증 도입(S7 ②) 전은 null(봉투 · 원장 · 결과 키 actor · 명령 조회 대조 기준) */
export function requestActor(_req: FastifyRequest): number | null {
  return null;
}

/** 도메인 거절 · 503에 명령 ID를 실어 헤더를 되싣게 한다 — 봉투 · 코드는 ApiError 그대로 */
export class BizWriteError extends ApiError {
  constructor(
    readonly original: ApiError,
    readonly cmdId: string,
  ) {
    super(original.code, original.message, original.details);
  }
}

/**
 * 컨트롤러 공용 — 포트에 넘기고 결과를 표면 응답으로 옮긴다.
 * result → 기존 상태 코드 · 본문 · accepted → 202 {cmdId, status} · BizWriteError → 헤더를 싣고 원 ApiError로 던진다(에러 봉투 필터).
 */
export async function submitWrite(
  port: BizWritePort,
  req: FastifyRequest,
  reply: FastifyReply,
  kind: BizKind,
  params: Record<string, number | string>,
  body?: unknown,
): Promise<unknown> {
  const idempotencyKey = idempotencyKeyOf(req);
  let out: BizWriteOutcome;
  try {
    out = await port.submit({ kind, params, body, actor: requestActor(req), idempotencyKey });
  } catch (e) {
    if (e instanceof BizWriteError) {
      reply.header(IDEMPOTENCY_HEADER, e.cmdId);
      throw e.original;
    }
    throw e;
  }
  if (out.type === 'accepted') {
    reply.header(IDEMPOTENCY_HEADER, out.cmdId).status(202);
    const accepted: CommandAcceptedBody = { cmdId: out.cmdId, status: out.status };
    return accepted;
  }
  if (out.cmdId) reply.header(IDEMPOTENCY_HEADER, out.cmdId);
  reply.status(out.httpStatus);
  return out.body;
}
