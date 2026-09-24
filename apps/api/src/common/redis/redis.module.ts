import { Global, Module } from '@nestjs/common';
import { CacheKeyClient } from './cache-key-client';
import { RedisConnections } from './connections';
import { DurableKeyClient } from './durable-key-client';
import { FanoutPublisher } from './fanout-publisher';

/** Redis 접근은 이 모듈의 래퍼 3종만 — 모듈이 ioredis를 직접 부르지 않는다(ADR-13) */
@Global()
@Module({
  providers: [RedisConnections, DurableKeyClient, CacheKeyClient, FanoutPublisher],
  exports: [RedisConnections, DurableKeyClient, CacheKeyClient, FanoutPublisher],
})
export class RedisModule {}
