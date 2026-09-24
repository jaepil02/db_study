// SW-01 on 구현 — 발행 파이프라인 1회 = XADD stream:plc:raw MAXLEN ~ + XINFO GROUPS(06_pipeline/02 §발행 · 적체 조회)
import type { DurableKeyClient } from '../../common/redis/durable-key-client';
import type { PointBufferPort, PublishResult } from './point-buffer.port';

export const RAW_STREAM = 'stream:plc:raw';
export const INGEST_GROUP = 'grp:ingest';

export class RedisStreamBuffer implements PointBufferPort {
  constructor(
    private readonly durable: DurableKeyClient,
    private readonly maxlen: number,
  ) {}

  async publish(payload: Buffer): Promise<PublishResult> {
    const { backlog } = await this.durable.xaddWithBacklog(RAW_STREAM, payload, this.maxlen, INGEST_GROUP);
    return { backlog };
  }
}
