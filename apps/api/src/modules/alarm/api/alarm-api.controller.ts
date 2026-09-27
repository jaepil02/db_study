// ALM 표면 — docs/07_api/07_alarms.md 표면 6(조회 3 · 쓰기 3). #1~#5 BFF 경유(no-store) · #6 직결.
// DELETE 메서드를 두지 않는다 — 규칙은 enabled false로 끄고, 이벤트는 사람이 닫지 않는다(REQ-ALM-01 · 원본에 없는 표면 판정).
// 쓰기 3(확인 · 규칙 등록 · 수정)은 업무 쓰기 포트(SW-12)를 거친다 — 상태 코드 · 본문 · 에러 봉투 불변(07_api/01 §업무 쓰기 경로).
// 인가(이벤트 · 규칙 조회 전원 · 확인 OPERATOR · 규칙 쓰기 · 분석 ENGINEER)는 인증 도입(S7 ②) 뒤다 — 그 전에는 확인 행위자만 시드 계정으로 대리한다.

import {
  AlarmEvalQuery,
  AlarmEventListQuery,
  AlarmRuleCreateRequest,
  AlarmRuleListQuery,
  AlarmRulePatchRequest,
  EventIdParam,
  RuleIdParam,
} from '@db-study/shared';
import { Body, Controller, Get, Header, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { parseOrThrow } from '../../../common/http/api-error';
import { BIZ_WRITE_PORT, type BizWritePort } from '../../biz/biz-contracts';
import { submitWrite } from '../../biz/idempotency';
import { AlarmEvalsService } from './alarm-evals.service';
import { AlarmEventsService } from './alarm-events.service';
import { AlarmRulesService } from './alarm-rules.service';

@Controller('api/v1/alarms')
export class AlarmApiController {
  constructor(
    private readonly events: AlarmEventsService,
    private readonly rules: AlarmRulesService,
    private readonly evals: AlarmEvalsService,
    @Inject(BIZ_WRITE_PORT) private readonly port: BizWritePort,
  ) {}

  // ── 이벤트 #1 · #2

  @Get('events')
  @Header('Cache-Control', 'no-store')
  listEvents(@Query() q: unknown) {
    return this.events.list(parseOrThrow(AlarmEventListQuery, q, 'query'));
  }

  @Post('events/:id/ack')
  @Header('Cache-Control', 'no-store')
  ack(@Param('id') id: string, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const params = { id: parseOrThrow(EventIdParam, id, 'path') };
    return submitWrite(this.port, req, res, 'alarm.event.ack', params);
  }

  // ── 규칙 #3 · #4 · #5

  @Get('rules')
  @Header('Cache-Control', 'no-store')
  async listRules(@Query() q: unknown) {
    const items = await this.rules.list(parseOrThrow(AlarmRuleListQuery, q, 'query'));
    return { items, meta: { count: items.length } };
  }

  @Post('rules')
  @Header('Cache-Control', 'no-store')
  createRule(@Body() b: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const body = parseOrThrow(AlarmRuleCreateRequest, b, 'body');
    return submitWrite(this.port, req, res, 'alarm.rule.create', {}, body);
  }

  @Patch('rules/:id')
  @Header('Cache-Control', 'no-store')
  patchRule(
    @Param('id') id: string,
    @Body() b: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const params = { id: parseOrThrow(RuleIdParam, id, 'path') };
    const body = parseOrThrow(AlarmRulePatchRequest, b, 'body');
    return submitWrite(this.port, req, res, 'alarm.rule.patch', params, body);
  }

  // ── 판정 이력 분석 #6(직결 · 캐시 없음)

  @Get('evaluations')
  @Header('Cache-Control', 'no-store')
  evaluations(@Query() q: unknown) {
    return this.evals.query(parseOrThrow(AlarmEvalQuery, q, 'query'));
  }
}
