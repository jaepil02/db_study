// 에러 봉투 필터 — REST 실패는 전부 봉투 하나(07_api/01 §에러 봉투)
// 500은 code를 싣지 않는다(결함은 설계된 실패가 아니다) · 스택 · SQL · 접속 문자열을 응답에 싣지 않는다(REQ-OBS-10).
import type { ErrorEnvelopeBody } from '@db-study/shared';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ApiError } from './api-error';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('ApiExceptionFilter');

  catch(err: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    let status = 500;
    let body: ErrorEnvelopeBody;
    if (err instanceof ApiError) {
      status = err.status;
      body = {
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      };
    } else if (err instanceof HttpException && err.getStatus() === 404) {
      // 경로 자체가 없다 — 표면 밖 요청도 봉투로 낸다
      status = 404;
      body = { error: { code: 'common.not_found', message: '없는 경로' } };
    } else if (err instanceof HttpException && err.getStatus() < 500) {
      status = 400;
      body = { error: { code: 'common.validation_failed', message: '요청 형식이 계약을 어긴다' } };
    } else {
      this.log.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
      body = { error: { message: '내부 오류' } };
    }
    void reply.status(status).header('content-type', 'application/json; charset=utf-8').send(body);
  }
}
