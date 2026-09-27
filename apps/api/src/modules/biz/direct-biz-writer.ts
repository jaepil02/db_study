// SW-12 direct — 옛 경로: api가 쓰기 서비스로 트랜잭션을 직접 커밋하고 응답한다(정본 docs/06_pipeline/07_business_crud.md §실패 의미 · 스위치)
// 명령 스트림 · 원장 · 결과 키 · 202 · 같은 키 재요청 방어가 없다 — Idempotency-Key는 표면이 형식만 검사하고 되싣지 않는다(cmdId null).
// 흐름 요약은 커밋과 체인 ②③ 뒤 1건 · role api-direct · 명령 경로 필드(cmdId · queueWaitMs · replyMs)는 null(07_api/11 §흐름 이벤트).
import { randomUUID } from 'node:crypto';
import type { BizCommandEnvelopeBody } from '@db-study/shared';
import type { FlowPublisher } from '../../common/flow/flow-publisher';
import { ApiError } from '../../common/http/api-error';
import type {
  BizApplyTrace,
  BizHandlers,
  BizWriteOutcome,
  BizWritePort,
  BizWriteRequest,
} from './biz-contracts';

const NO_TRACE: BizApplyTrace = { txMs: null, invalidateMs: null, invalidatedKeys: 0, cacheinv: false };

export class DirectBizWriter implements BizWritePort {
  readonly implName = 'DirectBizWriter' as const;

  constructor(
    private readonly handlers: BizHandlers,
    private readonly flow: FlowPublisher,
  ) {}

  async submit(req: BizWriteRequest): Promise<BizWriteOutcome> {
    // 봉투는 적용 서비스의 입력 모양일 뿐 — 스트림에 싣지 않고 원장도 쓰지 않는다(ledger false)
    const env: BizCommandEnvelopeBody = {
      cmdId: req.idempotencyKey ?? randomUUID(),
      kind: req.kind,
      payload: { params: req.params, ...(req.body === undefined ? {} : { body: req.body }) },
      actor: req.actor,
      requestedAt: Date.now(),
    };
    try {
      const out = await this.handlers.apply(env, { ledger: false });
      this.summarize(req, 'ok', out.trace);
      return { type: 'result', cmdId: null, httpStatus: out.httpStatus, body: out.body };
    } catch (e) {
      // 도메인 거절 · PostgreSQL 불가는 결과 코드로 요약한다 · 결함(500)은 요약하지 않는다
      if (e instanceof ApiError) {
        this.summarize(req, e.code, (e as ApiError & { trace?: BizApplyTrace }).trace ?? NO_TRACE);
      }
      throw e;
    }
  }

  private summarize(req: BizWriteRequest, result: string, trace: BizApplyTrace): void {
    if (!this.flow.enabled()) return;
    this.flow.publishBiz({
      role: 'api-direct',
      cmdId: null,
      kind: req.kind,
      result,
      duplicate: false,
      stages: { queueWaitMs: null, txMs: trace.txMs, invalidateMs: trace.invalidateMs, replyMs: null },
      invalidatedKeys: trace.invalidatedKeys,
      cacheinv: trace.cacheinv,
    });
  }
}
