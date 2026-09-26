// FanoutPublisher — 채널(ch) 래퍼(ADR-13 · 정본 docs/05_data_stores/05_redis_keyspace.md §Pub/Sub 채널)
// 발행 실패는 무시하고 계수한다 — Pub/Sub은 영속하지 않고 누락은 재연결 뒤 최신값 재조회가 메운다(§실패 전략 ch 행).
import type { WsServerMessageBody } from '@db-study/shared';
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

// 닫힌 레이블 값마다 0으로 시작한다(S5 관례)
for (const channel of ['rt', 'alarm', 'cacheinv']) publishFailures.inc({ channel }, 0);

/** ch:rt:{device_id} 페이로드 — 조건부 쓰기가 받아들인 (tag_id · ts · value · quality) 배열(06_pipeline/12 §봉인 계열 값과 채널 페이로드) */
export type RtChannelPayload = LatestTuple[];

@Injectable()
export class FanoutPublisher {
  private readonly redis: Redis;

  constructor(conns: RedisConnections) {
    this.redis = conns.command;
  }

  /**
   * 체인 ③ ch:cacheinv — 무효화된 키 이름 배열(접두 포함 · JSON). 한 쓰기의 키는 한 메시지로 낸다(발급은 두 tag_id).
   * SW-06 대상이 아니다 — 끄면 정합성 계약에 스위치가 생긴다(05_redis_keyspace §채널). 실패는 계수 · 삼킴이고 false를 돌려준다.
   */
  async publishCacheInv(keys: string[]): Promise<boolean> {
    if (keys.length === 0) return true;
    try {
      await this.redis.publish('ch:cacheinv', JSON.stringify(keys));
      return true;
    } catch {
      publishFailures.inc({ channel: 'cacheinv' });
      return false;
    }
  }

  /** ch:alarm — alarm 프레임 JSON 그대로(게이트웨이는 병합 없이 전 연결에 중계 · 07_api/11) · SW-06 대상 */
  async publishAlarm(frame: Extract<WsServerMessageBody, { type: 'alarm' }>): Promise<void> {
    try {
      await this.redis.publish('ch:alarm', JSON.stringify(frame));
    } catch {
      publishFailures.inc({ channel: 'alarm' });
    }
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
