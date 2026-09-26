import { Module } from '@nestjs/common';
import { CacheKeyClient } from '../../../common/redis/cache-key-client';
import { ACK_ACTOR_RESOLVER, EnvAckActorResolver } from './ack-actor';
import { AlarmApiController } from './alarm-api.controller';
import { ALARM_CACHE } from './alarm-cache';
import { AlarmEvalsService } from './alarm-evals.service';
import { AlarmEventsService } from './alarm-events.service';
import { AlarmRulesService } from './alarm-rules.service';

/**
 * ALM 표면(S7 ①) — 조회 3 · 쓰기 3 · 감사 · 캐시 무효화. HTTP 표면이라 all · api 역할만 싣는다(판정기는 AlarmEvalModule · all · worker).
 * 확인 행위자 해석은 포트 하나 — 인증 도입(S7 ②)에서 토큰 주체 구현으로 바꾼다.
 */
@Module({
  controllers: [AlarmApiController],
  providers: [
    AlarmEventsService,
    AlarmRulesService,
    AlarmEvalsService,
    { provide: ALARM_CACHE, useExisting: CacheKeyClient },
    { provide: ACK_ACTOR_RESOLVER, useClass: EnvAckActorResolver },
  ],
})
export class AlarmApiModule {}
