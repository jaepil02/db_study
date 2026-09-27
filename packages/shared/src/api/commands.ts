// 업무 명령 경로 계약 — 기전 정본 docs/06_pipeline/07_business_crud.md §업무 명령 경로
// 표면 의미(202 · 명령 조회 · Idempotency-Key) 정본 docs/07_api/01_conventions.md §업무 쓰기 경로 · §명령 조회 표면
// 키 · 채널 정본 docs/05_data_stores/05_redis_keyspace.md · 원장 정본 docs/05_data_stores/01_postgresql_schema.md §biz_command_log 설계
import { z } from 'zod';

/** 명령 종류 — 표면 하나가 kind 하나(도메인.대상.동작) · 구현된 업무 쓰기 14 = 마스터 11 + 알람 규칙 2 + 알람 확인 1 */
export const BIZ_KINDS = [
  'master.tag.create',
  'master.tag.patch',
  'master.tag.deactivate',
  'master.tag.reissue',
  'master.site.create',
  'master.site.patch',
  'master.line.create',
  'master.line.patch',
  'master.device.create',
  'master.device.patch',
  'master.modbus.put',
  'alarm.rule.create',
  'alarm.rule.patch',
  'alarm.event.ack',
] as const;
export type BizKind = (typeof BIZ_KINDS)[number];

/** 키 · 채널 · 그룹 이름 */
export const BIZ_STREAM = 'stream:biz:cmd';
export const BIZ_GROUP = 'grp:biz-writer';
/** 소비자 이름 고정 — 기동 시 자기 PEL(ID 0)부터 소진한다 */
export const BIZ_CONSUMER = 'biz-writer-1';
export const BIZ_REPLY_CHANNEL = 'ch:bizreply';
export const BIZ_WRITER_LOCK = 'lock:biz:writer';
export const bizResultKey = (cmdId: string) => `biz:result:${cmdId}`;
/** 스트림 엔트리의 단일 필드 — 값은 BizCommandEnvelope JSON */
export const BIZ_ENTRY_FIELD = 'c';

/** 2계층 조정값(현행 참고 · 소유 06_pipeline/07) */
export const BIZ_WAIT_MS = 5_000;
/** 결과 키 TTL = 명령 유효 창 */
export const BIZ_RESULT_TTL_S = 300;
export const BIZ_LOCK_TTL_MS = 15_000;
export const BIZ_LOCK_RENEW_MS = 5_000;

/** 요청 · 응답 헤더 — 명령 ID(UUID · 선택 · 없으면 api 발급 · 응답이 되싣는다) */
export const IDEMPOTENCY_HEADER = 'idempotency-key';

/** 명령 봉투 — 필드 5 */
export const BizCommandEnvelope = z.strictObject({
  cmdId: z.uuid(),
  kind: z.enum(BIZ_KINDS),
  /** 스키마 검증을 통과한 요청 본문 · 경로 식별자 — { params, body } */
  payload: z.strictObject({
    params: z.record(z.string(), z.union([z.number(), z.string()])),
    body: z.unknown().optional(),
  }),
  /** 요청자 user_id · 인증 전(S7 ②) null */
  actor: z.number().int().nullable(),
  /** api 수신 epoch ms */
  requestedAt: z.number().int(),
});
export type BizCommandEnvelopeBody = z.infer<typeof BizCommandEnvelope>;

/** 오류 객체 — 에러 봉투의 error와 같은 모양 */
export const BizErrorObject = z.strictObject({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

/**
 * 결과 키 biz:result:{cmdId} · 원장 result jsonb의 모양(원장 status 3 + 결과 키에만 있는 FAILED).
 * APPLIED — httpStatus 201 · 200 + body · REJECTED — httpStatus 400 · 404 · 409 + error ·
 * EXPIRED — 둘 다 없음 · FAILED — httpStatus 503 + error(common.postgres_unavailable · 원장 행 없음)
 */
export const BizResult = z.strictObject({
  status: z.enum(['APPLIED', 'REJECTED', 'EXPIRED', 'FAILED']),
  actor: z.number().int().nullable(),
  httpStatus: z.number().int().optional(),
  body: z.unknown().optional(),
  error: BizErrorObject.optional(),
});
export type BizResultBody = z.infer<typeof BizResult>;

/** 명령 조회 GET /api/v1/commands/{cmdId} 응답(200) — status 5 */
export const COMMAND_STATUSES = ['pending', 'applied', 'rejected', 'failed', 'expired'] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];
export const CommandStatusBody = z.strictObject({
  cmdId: z.uuid(),
  status: z.enum(COMMAND_STATUSES),
  httpStatus: z.number().int().optional(),
  result: z.unknown().optional(),
  error: BizErrorObject.optional(),
});
export type CommandStatusBodyT = z.infer<typeof CommandStatusBody>;

/** 대기 상한을 넘긴 쓰기 · 만료된 키 재요청의 202 본문 */
export const CommandAccepted = z.strictObject({
  cmdId: z.uuid(),
  status: z.enum(['pending', 'expired']),
});
export type CommandAcceptedBody = z.infer<typeof CommandAccepted>;

/** 결과 → 명령 조회 status */
export function commandStatusOf(r: BizResultBody): CommandStatus {
  switch (r.status) {
    case 'APPLIED':
      return 'applied';
    case 'REJECTED':
      return 'rejected';
    case 'EXPIRED':
      return 'expired';
    case 'FAILED':
      return 'failed';
  }
}
