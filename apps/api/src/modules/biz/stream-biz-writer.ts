// SW-12 stream — 업무 쓰기를 명령 스트림에 싣고 워커의 결과를 기다린다(기전 정본 docs/06_pipeline/07_business_crud.md §업무 명령 경로)
// ① 대기 맵 등록 → XADD stream:biz:cmd(등록이 먼저 — 워커가 빨리 끝내 알림이 등록 전에 오면 대기 상한까지 기다린다)
// ⑧ ch:bizreply 구독자 1이 cmdId를 대기 맵에서 찾아 깨운다 → 결과 키(없으면 원장)를 읽어 기존 상태 코드 · 본문으로 응답한다.
// 대기 상한 5초 초과 → 202 pending · XADD 실패(Redis 불가) → common.postgres_unavailable/503(새 코드 없음 · 원장으로 우회하지 않는다).
// 대기 맵은 인스턴스 로컬이다 — 알림은 모든 api 인스턴스에 가고 cmdId를 가진 인스턴스만 응답한다(§시간 초과 · 명령 조회).
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import {
  BIZ_ENTRY_FIELD,
  BIZ_REPLY_CHANNEL,
  BIZ_STREAM,
  BIZ_WAIT_MS,
  type BizCommandEnvelopeBody,
  type BizResultBody,
  ERROR_HTTP_STATUS,
  type ErrorCode,
} from '@db-study/shared';
import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { ApiError } from '../../common/http/api-error';
import type { DurableKeyClient } from '../../common/redis/durable-key-client';
import { countBizApi, observeBizWait } from './biz-api.metrics';
import type { BizWriteOutcome, BizWritePort, BizWriteRequest } from './biz-contracts';
import type { CommandLookup } from './commands.controller';
import { BizWriteError } from './idempotency';

/** MAXLEN ~ 10000(현행 참고 · 정본 05_data_stores/06 — 관계 MAXLEN ≥ 명령 유효 창 × 최대 업무 쓰기율) */
export const BIZ_STREAM_MAXLEN = 10_000;

const PG_DOWN = () => new ApiError('common.postgres_unavailable', '업무 쓰기 저장소에 명령을 실을 수 없다');

/** 결과의 오류 객체 → ApiError(코드 · HTTP 상태 불변) · 카탈로그 밖 코드는 결함(500) */
export function apiErrorOf(r: BizResultBody): ApiError {
  const e = r.error;
  if (!e) {
    if (r.status === 'FAILED') return PG_DOWN();
    throw new Error(`결과에 오류 객체가 없다 — ${r.status}`);
  }
  if (!(e.code in ERROR_HTTP_STATUS)) throw new Error(`카탈로그 밖 오류 코드 — ${e.code}`);
  return new ApiError(e.code as ErrorCode, e.message, e.details);
}

/** 결과 → 포트 결과 — 적용은 기존 응답 · 거절 · failed는 BizWriteError · 만료는 202 expired */
export function outcomeOf(cmdId: string, r: BizResultBody): BizWriteOutcome {
  switch (r.status) {
    case 'APPLIED':
      return { type: 'result', cmdId, httpStatus: r.httpStatus ?? 200, body: r.body ?? null };
    case 'EXPIRED':
      return { type: 'accepted', cmdId, status: 'expired' };
    case 'REJECTED':
    case 'FAILED':
      throw new BizWriteError(apiErrorOf(r), cmdId);
  }
}

const WAIT_RESULT = {
  APPLIED: 'applied',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  FAILED: 'failed',
} as const;

export class StreamBizWriter implements BizWritePort {
  readonly implName = 'StreamBizWriter' as const;
  private readonly log = new Logger('StreamBizWriter');
  /** cmdId → 깨울 대기자들(같은 키 동시 재요청은 같은 알림을 함께 기다린다) */
  private readonly waiters = new Map<string, Set<() => void>>();

  constructor(
    private readonly durable: DurableKeyClient,
    private readonly lookup: CommandLookup,
    private readonly waitMs = BIZ_WAIT_MS,
  ) {}

  /** 구독자 1 — 구독 연결에는 다른 채널(ch:flow 등)도 올 수 있어 채널로 거른다 · 재연결 시 ioredis가 다시 구독한다 */
  listen(sub: Redis): void {
    sub.on('message', (channel: string, message: string) => {
      if (channel === BIZ_REPLY_CHANNEL) this.notify(message);
    });
    sub.subscribe(BIZ_REPLY_CHANNEL).catch((e: Error) => {
      // 구독이 없으면 쓰기는 전부 대기 상한에서 202가 된다 — 적용 누락은 아니다(결과는 결과 키 · 원장에 남는다)
      this.log.warn(`${BIZ_REPLY_CHANNEL} 구독 실패 — ${e.message}`);
    });
  }

  /** 알림 한 건 — 대기 맵에 없으면(다른 인스턴스의 명령) 버린다 */
  notify(cmdId: string): void {
    const set = this.waiters.get(cmdId);
    if (!set) return;
    this.waiters.delete(cmdId);
    for (const wake of set) wake();
  }

  /** 대기 맵 등록 — 등록 즉시 상한 타이머가 돈다 · true = 알림 · false = 상한 */
  arm(cmdId: string): { done: Promise<boolean>; cancel: () => void } {
    let wake!: () => void;
    let timer: NodeJS.Timeout | undefined;
    const done = new Promise<boolean>((resolve) => {
      wake = () => {
        clearTimeout(timer);
        resolve(true);
      };
      timer = setTimeout(() => {
        this.drop(cmdId, wake);
        resolve(false);
      }, this.waitMs);
    });
    let set = this.waiters.get(cmdId);
    if (!set) {
      set = new Set();
      this.waiters.set(cmdId, set);
    }
    set.add(wake);
    return {
      done,
      cancel: () => {
        clearTimeout(timer);
        this.drop(cmdId, wake);
      },
    };
  }

  /** 관찰용 — 대기 중인 cmdId 수 */
  pendingCount(): number {
    return this.waiters.size;
  }

  private drop(cmdId: string, wake: () => void): void {
    const set = this.waiters.get(cmdId);
    if (!set) return;
    set.delete(wake);
    if (set.size === 0) this.waiters.delete(cmdId);
  }

  async submit(req: BizWriteRequest): Promise<BizWriteOutcome> {
    const cmdId = req.idempotencyKey ?? randomUUID();
    if (req.idempotencyKey) {
      // 같은 키 재요청 — 첫 판정(적용 · 거절 · 만료)이 결과 키에 있으면 적용 없이 같은 응답.
      // failed(첫 시도 503)는 다시 싣는다 — 워커가 원장을 다시 확인해 행이 있으면 저장된 판정, 없으면 적용한다(③).
      // 결과 키가 없으면(아직 pending · 축출 · 만료) 다시 싣는다 — 워커 ③이 원장으로 이중 적용을 막는다.
      const prior = await this.lookup.resultKey(cmdId);
      if (prior && prior.status !== 'FAILED') return outcomeOf(cmdId, prior);
    }
    const env: BizCommandEnvelopeBody = {
      cmdId,
      kind: req.kind,
      payload: { params: req.params, ...(req.body === undefined ? {} : { body: req.body }) },
      actor: req.actor,
      requestedAt: Date.now(),
    };
    const waiter = this.arm(cmdId); // 등록이 XADD보다 먼저
    const t0 = performance.now();
    try {
      await this.durable.xaddBizCommand(BIZ_STREAM, BIZ_ENTRY_FIELD, JSON.stringify(env), BIZ_STREAM_MAXLEN);
    } catch (e) {
      waiter.cancel();
      countBizApi(req.kind, 'unavailable');
      this.log.warn(`XADD ${BIZ_STREAM} 실패 — ${(e as Error).message}`);
      throw new BizWriteError(PG_DOWN(), cmdId);
    }
    if (await waiter.done) {
      const r = await this.lookup.findQuiet(cmdId);
      if (r) {
        observeBizWait(WAIT_RESULT[r.status], (performance.now() - t0) / 1000);
        return outcomeOf(cmdId, r);
      }
      // 알림은 왔는데 결과 키 · 원장을 못 읽었다 — 명령 조회가 결과를 낸다
    }
    observeBizWait('timeout', (performance.now() - t0) / 1000);
    countBizApi(req.kind, 'timeout');
    return { type: 'accepted', cmdId, status: 'pending' };
  }
}
