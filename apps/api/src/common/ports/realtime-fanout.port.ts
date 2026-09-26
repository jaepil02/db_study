// SW-06 REDIS_PUBSUB_FANOUT — RealtimeFanoutPort(정본 04_architecture/02 · 대상 ch:rt · ch:alarm · 모듈 ingest · alarms)
// on = RedisPubSubFanout — PUBLISH ch:rt:{device_id} → 게이트웨이 SUBSCRIBE(역할 분리 · 수평 확장에서 코드가 같다 · ADR-07)
// off = DirectGatewayFanout — 발행자가 같은 프로세스의 게이트웨이를 직접 부른다(프로세스 안 버스) · api 인스턴스 1 · APP_ROLE all만(제약 #6)
// ch:cacheinv는 대상이 아니다 — 끄면 무효화 체인 정합성 계약에 스위치가 생긴다(05_redis_keyspace §채널).
// ch:alarm(S7 ①) — 판정기가 PostgreSQL 커밋 뒤에만 부른다(REQ-ALM-10) · 프레임 모양 정본 07_api/11 §메시지 봉투 alarm 행 · 병합 없음.
// 발행 시각 도장 — rlt_fanout_delivery_seconds(발행 → 게이트웨이 도착)를 두 구현이 같은 자리에서 재게 한다(EXP-11 · AC-40).
import { EventEmitter } from 'node:events';
import type { AlarmFrameBody } from '@db-study/shared';
import type { LatestTuple } from '../redis/durable-key-client';
import type { FanoutPublisher } from '../redis/fanout-publisher';

export const REALTIME_FANOUT_PORT = Symbol('RealtimeFanoutPort');

export interface RealtimeFanoutPort {
  readonly implName: 'RedisPubSubFanout' | 'DirectGatewayFanout';
  publishRt(deviceId: number, accepted: LatestTuple[]): Promise<void>;
  /** 알람 열림 · 닫힘 — 실패는 계수 · 삼킴(누락은 재연결 목록 재조회가 메운다) */
  publishAlarm(frame: AlarmFrame): Promise<void>;
}

/** alarm 프레임 — { type: 'alarm', eventId, ruleId, tagId, transition: OPENED · CLEARED, ts(전이 행 측정 시각 epoch ms), severity } · 정의는 packages/shared */
export type AlarmFrame = AlarmFrameBody;

/** 프로세스 안 버스 — DirectGatewayFanout이 쏘고 게이트웨이가 받는다(모듈 사이 의존을 만들지 않는다) */
export const directBus = new EventEmitter();
directBus.setMaxListeners(4);

/** 발행 도장 — 키 = 설비 · 받아들인 튜플의 최대 ts · 한 프로세스 안에서만 의미가 있다(역할 분리면 게이트웨이가 못 찾아 재지 않는다) */
const stamps = new Map<string, number>();
const STAMP_LIMIT = 10_000;
export function stampKey(deviceId: number, tuples: readonly LatestTuple[]): string {
  let max = 0;
  for (const t of tuples) if (t[1] > max) max = t[1];
  return `${deviceId}:${max}:${tuples.length}`;
}
export function stampPublish(deviceId: number, tuples: readonly LatestTuple[]): void {
  if (stamps.size >= STAMP_LIMIT) stamps.clear();
  stamps.set(stampKey(deviceId, tuples), performance.now());
}
/** 도착 — 도장이 있으면 경과 초 · 없으면 null */
export function takeStamp(deviceId: number, tuples: readonly LatestTuple[]): number | null {
  const k = stampKey(deviceId, tuples);
  const t = stamps.get(k);
  if (t === undefined) return null;
  stamps.delete(k);
  return (performance.now() - t) / 1000;
}

export class RedisPubSubFanout implements RealtimeFanoutPort {
  readonly implName = 'RedisPubSubFanout' as const;
  constructor(private readonly fanout: FanoutPublisher) {}
  async publishRt(deviceId: number, accepted: LatestTuple[]): Promise<void> {
    if (accepted.length === 0) return;
    stampPublish(deviceId, accepted);
    await this.fanout.publishRt(deviceId, accepted);
  }
  async publishAlarm(frame: AlarmFrame): Promise<void> {
    await this.fanout.publishAlarm(frame);
  }
}

export class DirectGatewayFanout implements RealtimeFanoutPort {
  readonly implName = 'DirectGatewayFanout' as const;
  async publishRt(deviceId: number, accepted: LatestTuple[]): Promise<void> {
    if (accepted.length === 0) return;
    stampPublish(deviceId, accepted);
    directBus.emit('rt', deviceId, accepted);
  }
  async publishAlarm(frame: AlarmFrame): Promise<void> {
    directBus.emit('alarm', frame);
  }
}
