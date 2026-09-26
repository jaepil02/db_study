// ALM 표면 — docs/07_api/07_alarms.md 표면 6(조회 3 · 쓰기 3). #1~#5 BFF 경유(no-store) · #6 직결.
// DELETE 메서드를 두지 않는다 — 규칙은 enabled false로 끄고, 이벤트는 사람이 닫지 않는다(REQ-ALM-01 · 원본에 없는 표면 판정).
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
import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { parseOrThrow } from '../../../common/http/api-error';
import { AlarmEvalsService } from './alarm-evals.service';
import { AlarmEventsService } from './alarm-events.service';
import { AlarmRulesService } from './alarm-rules.service';

@Controller('api/v1/alarms')
export class AlarmApiController {
  constructor(
    private readonly events: AlarmEventsService,
    private readonly rules: AlarmRulesService,
    private readonly evals: AlarmEvalsService,
  ) {}

  // ── 이벤트 #1 · #2

  @Get('events')
  @Header('Cache-Control', 'no-store')
  listEvents(@Query() q: unknown) {
    return this.events.list(parseOrThrow(AlarmEventListQuery, q, 'query'));
  }

  @Post('events/:id/ack')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  ack(@Param('id') id: string) {
    return this.events.ack(parseOrThrow(EventIdParam, id, 'path'));
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
  createRule(@Body() b: unknown) {
    return this.rules.create(parseOrThrow(AlarmRuleCreateRequest, b, 'body'));
  }

  @Patch('rules/:id')
  @Header('Cache-Control', 'no-store')
  patchRule(@Param('id') id: string, @Body() b: unknown) {
    return this.rules.patch(
      parseOrThrow(RuleIdParam, id, 'path'),
      parseOrThrow(AlarmRulePatchRequest, b, 'body'),
    );
  }

  // ── 판정 이력 분석 #6(직결 · 캐시 없음)

  @Get('evaluations')
  @Header('Cache-Control', 'no-store')
  evaluations(@Query() q: unknown) {
    return this.evals.query(parseOrThrow(AlarmEvalQuery, q, 'query'));
  }
}
