// 업무 명령 경로의 모듈 간 계약(리드 소유) — 기전 정본 docs/06_pipeline/07_business_crud.md §업무 명령 경로
// 표면(컨트롤러) → BizWritePort(SW-12: StreamBizWriter · DirectBizWriter) → BizHandlers(kind → 기존 쓰기 서비스 · 트랜잭션 하나)
// 구현 소유: BizHandlers · 명령 워커 = biz 적용 쪽 · BizWritePort 두 구현 · 명령 조회 = biz 표면 쪽. 이 파일의 모양을 바꾸려면 리드에게 보고한다.
import type { BizCommandEnvelopeBody, BizKind } from '@db-study/shared';

/** 적용 한 번의 관찰값 — 흐름 요약(event biz) stages · invalidatedKeys · cacheinv의 원천 */
export interface BizApplyTrace {
  /** ⑤ BEGIN → COMMIT 또는 롤백(ms) · 적용하지 않았으면 null */
  txMs: number | null;
  /** ⑥ 체인 ②③(캐시 DEL · ch:cacheinv) ms · 체인이 없으면 null */
  invalidateMs: number | null;
  /** 체인 ②에서 지운 키 수 */
  invalidatedKeys: number;
  /** 체인 ③ ch:cacheinv 발행 여부 */
  cacheinv: boolean;
}

/** 적용 성공 — 기존 표면과 같은 상태 코드(201 · 200) · 본문 */
export interface BizApplyOutcome {
  httpStatus: number;
  body: unknown;
  trace: BizApplyTrace;
}

/**
 * kind → 기존 쓰기 서비스. 명령 하나 = 트랜잭션 하나(업무 행 · audit_log).
 * ledger가 true면 **같은 트랜잭션 안 COMMIT 직전**에 biz_command_log APPLIED 행을 넣는다(멱등의 유일한 근거).
 * 도메인 오류(UNIQUE · FK · CHECK · 조건부 갱신)는 ApiError를 던진다(트랜잭션은 롤백됨 · trace는 err.trace로 붙일 수 있다).
 * PostgreSQL 불가는 ApiError common.postgres_unavailable.
 * 체인 ②③은 커밋 뒤 · 반환 전(⑥이 ⑦보다 앞) · ④는 응답 뒤.
 */
export interface BizHandlers {
  apply(env: BizCommandEnvelopeBody, opts: { ledger: boolean }): Promise<BizApplyOutcome>;
}
export const BIZ_HANDLERS = Symbol('BIZ_HANDLERS');

/** 표면이 포트에 넘기는 요청 — 스키마 검증 · 인가가 끝난 값 */
export interface BizWriteRequest {
  kind: BizKind;
  params: Record<string, number | string>;
  body?: unknown;
  /** 요청자 user_id · 인증 전 null */
  actor: number | null;
  /** 요청 헤더 Idempotency-Key(UUID 형식 검사는 표면이 끝냈다) · 없으면 null(stream이면 포트가 발급) */
  idempotencyKey: string | null;
}

/**
 * 포트 결과 — result: 기존 상태 코드 · 본문으로 응답(stream이면 응답 헤더 Idempotency-Key = cmdId · direct면 헤더 없음)
 * accepted: 202 + {cmdId, status}(대기 상한 초과 pending · 만료된 키 재요청 expired).
 * 도메인 거절 · 503은 ApiError를 던진다(에러 봉투 · 코드 불변) — stream이면 던진 오류에 cmdId를 실어 헤더를 되싣는다(BizWriteError).
 */
export type BizWriteOutcome =
  | { type: 'result'; cmdId: string | null; httpStatus: number; body: unknown }
  | { type: 'accepted'; cmdId: string; status: 'pending' | 'expired' };

export interface BizWritePort {
  readonly implName: 'StreamBizWriter' | 'DirectBizWriter';
  submit(req: BizWriteRequest): Promise<BizWriteOutcome>;
}
export const BIZ_WRITE_PORT = Symbol('BIZ_WRITE_PORT');
