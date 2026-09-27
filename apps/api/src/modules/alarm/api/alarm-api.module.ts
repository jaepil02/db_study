import { Module } from '@nestjs/common';
import { CacheKeyClient } from '../../../common/redis/cache-key-client';
import { ACK_ACTOR_RESOLVER, EnvAckActorResolver } from './ack-actor';
import { AlarmApiController } from './alarm-api.controller';
import { ALARM_CACHE } from './alarm-cache';
import { AlarmEvalsService } from './alarm-evals.service';
import { AlarmEventsService } from './alarm-events.service';
import { AlarmRulesService } from './alarm-rules.service';

/**
 * ALM 쓰기 서비스(규칙 등록 · 수정 · 확인) — 컨트롤러 없음. 표면(AlarmApiModule)과 업무 명령 적용(BizApplyModule — 명령 워커 · SW-12 direct)이 함께 쓴다.
 * 확인 행위자 해석은 포트 하나 — 인증 도입(S7 ②)에서 토큰 주체 구현으로 바꾼다(명령 워커도 확인 트랜잭션 첫 문장에서 해석한다).
 */
@Module({
  providers: [
    AlarmEventsService,
    AlarmRulesService,
    { provide: ALARM_CACHE, useExisting: CacheKeyClient },
    { provide: ACK_ACTOR_RESOLVER, useClass: EnvAckActorResolver },
  ],
  exports: [AlarmEventsService, AlarmRulesService],
})
export class AlarmWriteModule {}

/** ALM 표면(S7 ①) — 조회 3 · 쓰기 3 · 감사 · 캐시 무효화. HTTP 표면이라 all · api 역할만 싣는다(판정기는 AlarmEvalModule · all · worker) */
@Module({
  imports: [AlarmWriteModule],
  controllers: [AlarmApiController],
  providers: [AlarmEvalsService],
})
export class AlarmApiModule {}
