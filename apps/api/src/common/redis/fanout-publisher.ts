// FanoutPublisher — 채널(ch) 래퍼(ADR-13 · 정본 docs/05_data_stores/05_redis_keyspace.md §Pub/Sub 채널)
// 발행 실패는 무시하고 계수한다 — Pub/Sub은 영속하지 않고 누락은 재연결 뒤 최신값 재조회가 메운다(§실패 전략 ch 행).
import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { Counter } from 'prom-client';
import { appRegistry } from '../metrics/registry';
import { RedisConnections } from './connections';
import type { LatestTuple } from './durable-key-client';

const publishFailures = new Counter({
  name: 'rlt_publish_failures_total',
  help: 'FanoutPublisher 발행 실패(계수 · 삼킴)',
  labelNames: ['channel'],
  registers: [appRegistry],
});

/** ch:rt:{device_id} 페이로드 — 조건부 쓰기가 받아들인 (tag_id · ts · value · quality) 배열(06_pipeline/12 §봉인 계열 값과 채널 페이로드) */
export type RtChannelPayload = LatestTuple[];

@Injectable()
export class FanoutPublisher {
  private readonly redis: Redis;

  constructor(conns: RedisConnections) {
    this.redis = conns.command;
  }

  async publishRt(deviceId: number, accepted: LatestTuple[]): Promise<void> {
    if (accepted.length === 0) return;
    try {
      await this.redis.publish(`ch:rt:${deviceId}`, JSON.stringify(accepted));
    } catch {
      publishFailures.inc({ channel: 'rt' });
    }
  }
}
