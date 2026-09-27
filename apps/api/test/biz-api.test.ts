// 업무 쓰기 포트(SW-12) · Idempotency-Key · 명령 조회 표면 — 정본 07_api/01 §업무 쓰기 경로 · §명령 조회 표면 · 06_pipeline/07 §업무 명령 경로
// 저장소 없이 가짜 스트림 · 결과 키 · 원장 · 적용 서비스로 본다. 표면 응답(상태 코드 · 헤더 · 에러 봉투)은 Nest + Fastify 앱을 inject로 부른다.
import 'reflect-metadata';
import {
  BIZ_ENTRY_FIELD,
  BIZ_REPLY_CHANNEL,
  BIZ_STREAM,
  BizCommandEnvelope,
  type BizResultBody,
  CommandStatusBody,
  ErrorEnvelope,
  IDEMPOTENCY_HEADER,
} from '@db-study/shared';
import { Body, Controller, Inject, Module, Post, Req, Res } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FlowBizInput, FlowPublisher } from '../src/common/flow/flow-publisher';
import { ApiError } from '../src/common/http/api-error';
import { ApiExceptionFilter } from '../src/common/http/exception-filter';
import type { SwitchRegistry } from '../src/common/ports/switch-registry';
import type { CacheKeyClient } from '../src/common/redis/cache-key-client';
import type { RedisConnections } from '../src/common/redis/connections';
import type { DurableKeyClient } from '../src/common/redis/durable-key-client';
import { loadConfig } from '../src/config/app-config';
import { AlarmApiController } from '../src/modules/alarm/api/alarm-api.controller';
import type { AlarmEvalsService } from '../src/modules/alarm/api/alarm-evals.service';
import type { AlarmEventsService } from '../src/modules/alarm/api/alarm-events.service';
import type { AlarmRulesService } from '../src/modules/alarm/api/alarm-rules.service';
import { bizMetrics } from '../src/modules/biz/biz.metrics';
import { bizCommandSeconds } from '../src/modules/biz/biz-api.metrics';
import {
  BIZ_WRITE_PORT,
  type BizApplyOutcome,
  type BizHandlers,
  type BizWriteOutcome,
  type BizWritePort,
  type BizWriteRequest,
} from '../src/modules/biz/biz-contracts';
import type { BizLedger, LedgerRow } from '../src/modules/biz/biz-ledger';
import { bizWritePortFactory } from '../src/modules/biz/biz-write.module';
import { CommandLookup, CommandsController } from '../src/modules/biz/commands.controller';
import { DirectBizWriter } from '../src/modules/biz/direct-biz-writer';
import { BizWriteError, idempotencyKeyOf, submitWrite } from '../src/modules/biz/idempotency';
import { StreamBizWriter } from '../src/modules/biz/stream-biz-writer';
import { MasterController } from '../src/modules/master/master.controller';
import type { MasterReadService } from '../src/modules/master/master-read.service';

const KEY = '0b6e2f7a-3c4d-4e5f-8a9b-1c2d3e4f5a6b';
const KEY2 = '1c7f3a8b-4d5e-4f60-9bac-2d3e4f5a6b7c';

// ── 가짜

class FakeResults {
  readonly map = new Map<string, BizResultBody>();
  failed = false;
  asCache(): CacheKeyClient {
    return {
      getBizResult: async (cmdId: string) =>
        this.failed
          ? { value: null, failed: true }
          : { value: this.map.has(cmdId) ? JSON.stringify(this.map.get(cmdId)) : null, failed: false },
    } as unknown as CacheKeyClient;
  }
}

class FakeLedger {
  readonly rows = new Map<string, LedgerRow>();
  down = false;
  async find(cmdId: string): Promise<LedgerRow | null> {
    if (this.down) throw new ApiError('common.postgres_unavailable', 'PostgreSQL에 접속할 수 없다');
    return this.rows.get(cmdId) ?? null;
  }
}

/** XADD 가짜 — 부를 때의 대기 맵 상태를 기록하고, onAdd로 워커를 흉내 낸다 */
class FakeStream {
  readonly adds: { stream: string; field: string; json: string; maxlen: number; waiting: number }[] = [];
  fail = false;
  writer: StreamBizWriter | null = null;
  onAdd: ((cmdId: string) => void) | null = null;
  asDurable(): DurableKeyClient {
    return {
      xaddBizCommand: async (stream: string, field: string, json: string, maxlen: number) => {
        this.adds.push({ stream, field, json, maxlen, waiting: this.writer?.pendingCount() ?? -1 });
        if (this.fail) throw new Error('connect ECONNREFUSED');
        const env = BizCommandEnvelope.parse(JSON.parse(json));
        this.onAdd?.(env.cmdId);
        return '1-0';
      },
    } as unknown as DurableKeyClient;
  }
}

function rig(waitMs = 40) {
  const results = new FakeResults();
  const ledger = new FakeLedger();
  const stream = new FakeStream();
  const lookup = new CommandLookup(results.asCache(), ledger as unknown as BizLedger);
  const writer = new StreamBizWriter(stream.asDurable(), lookup, waitMs);
  stream.writer = writer;
  return { results, ledger, stream, lookup, writer };
}

const req = (over: Partial<BizWriteRequest> = {}): BizWriteRequest => ({
  kind: 'master.site.create',
  params: {},
  body: { siteCode: 'S9', siteName: '구미' },
  actor: null,
  idempotencyKey: null,
  ...over,
});

const APPLIED: BizResultBody = { status: 'APPLIED', actor: null, httpStatus: 201, body: { siteId: 9 } };
const REJECTED: BizResultBody = {
  status: 'REJECTED',
  actor: null,
  httpStatus: 409,
  error: { code: 'common.duplicate_key', message: '같은 코드가 이미 있다', details: { field: 'siteCode' } },
};
const FAILED: BizResultBody = {
  status: 'FAILED',
  actor: null,
  httpStatus: 503,
  error: { code: 'common.postgres_unavailable', message: 'PostgreSQL에 접속할 수 없다' },
};
const EXPIRED: BizResultBody = { status: 'EXPIRED', actor: null };

async function counter(kind: string, result: string): Promise<number> {
  const v = (await bizMetrics.commands.get()).values.find(
    (x) => x.labels.kind === kind && x.labels.result === result,
  );
  return v?.value ?? 0;
}

async function waitCount(result: string): Promise<number> {
  const v = (await bizCommandSeconds.get()).values.find(
    (x) => x.metricName === 'biz_command_seconds_count' && x.labels.result === result,
  );
  return v?.value ?? 0;
}

async function rejects(p: Promise<unknown>): Promise<BizWriteError> {
  try {
    await p;
  } catch (e) {
    return e as BizWriteError;
  }
  throw new Error('던지지 않았다');
}

// ── StreamBizWriter

describe('StreamBizWriter — 대기 맵 등록 → XADD → 결과 · 상한', () => {
  it('대기 맵 등록이 XADD보다 먼저 — XADD 시점에 이미 대기 중이고, XADD 도중 온 알림도 받는다', async () => {
    const { results, stream, writer } = rig(5_000);
    stream.onAdd = (cmdId) => {
      // 워커가 XADD 응답보다 먼저 끝낸 경우 — 결과 SET → 알림
      results.map.set(cmdId, APPLIED);
      writer.notify(cmdId);
    };
    const t0 = Date.now();
    const out = await writer.submit(req({ idempotencyKey: KEY }));
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(stream.adds[0]?.waiting).toBe(1);
    expect(out).toEqual({ type: 'result', cmdId: KEY, httpStatus: 201, body: { siteId: 9 } });
    expect(writer.pendingCount()).toBe(0);
  });

  it('봉투 5필드 · 엔트리 필드 c · stream:biz:cmd · MAXLEN 10000 · 키가 없으면 api가 UUID를 발급한다', async () => {
    const { stream, writer } = rig(10);
    const out = await writer.submit(req({ actor: 7, params: { id: 3 }, kind: 'master.site.patch' }));
    const add = stream.adds[0];
    expect(add?.stream).toBe(BIZ_STREAM);
    expect(add?.field).toBe(BIZ_ENTRY_FIELD);
    expect(add?.maxlen).toBe(10_000);
    const env = BizCommandEnvelope.parse(JSON.parse(add?.json ?? '{}'));
    expect(env.kind).toBe('master.site.patch');
    expect(env.actor).toBe(7);
    expect(env.payload).toEqual({ params: { id: 3 }, body: { siteCode: 'S9', siteName: '구미' } });
    expect(out.type === 'accepted' && out.cmdId).toBe(env.cmdId);
  });

  it('대기 상한 → 202 pending · timeout 계수 · 대기 맵 비움', async () => {
    const { writer } = rig(30);
    const before = await counter('master.site.create', 'timeout');
    const beforeWait = await waitCount('timeout');
    const out = await writer.submit(req({ idempotencyKey: KEY2 }));
    expect(out).toEqual({ type: 'accepted', cmdId: KEY2, status: 'pending' });
    expect(await counter('master.site.create', 'timeout')).toBe(before + 1);
    expect(await waitCount('timeout')).toBe(beforeWait + 1);
    expect(writer.pendingCount()).toBe(0);
  });

  it('결과 도착 → 기존 상태 코드 · 본문(비동기 알림 · 결과 키)', async () => {
    const { results, stream, writer } = rig(2_000);
    stream.onAdd = (cmdId) =>
      setTimeout(() => {
        results.map.set(cmdId, { status: 'APPLIED', actor: null, httpStatus: 200, body: { tagId: 1 } });
        writer.notify(cmdId);
      }, 5);
    const before = await waitCount('applied');
    const out = await writer.submit(req({ kind: 'master.tag.patch', params: { id: 1 } }));
    expect(out).toMatchObject({ type: 'result', httpStatus: 200, body: { tagId: 1 } });
    expect(await waitCount('applied')).toBe(before + 1);
  });

  it('결과 키 축출 → 원장에서 읽는다', async () => {
    const { ledger, stream, writer } = rig(2_000);
    stream.onAdd = (cmdId) => {
      ledger.rows.set(cmdId, { status: 'APPLIED', actor: null, result: APPLIED });
      writer.notify(cmdId);
    };
    expect(await writer.submit(req())).toMatchObject({ type: 'result', httpStatus: 201 });
  });

  it('도메인 거절 → 같은 코드 · 상태(409 duplicate_key · details) · 명령 ID 실림', async () => {
    const { results, stream, writer } = rig(2_000);
    stream.onAdd = (cmdId) => {
      results.map.set(cmdId, REJECTED);
      writer.notify(cmdId);
    };
    const e = await rejects(writer.submit(req({ idempotencyKey: KEY })));
    expect(e).toBeInstanceOf(BizWriteError);
    expect(e.cmdId).toBe(KEY);
    expect(e.original.code).toBe('common.duplicate_key');
    expect(e.original.status).toBe(409);
    expect(e.original.details).toEqual({ field: 'siteCode' });
  });

  it('PostgreSQL 불가 결과(failed) → 503 common.postgres_unavailable', async () => {
    const { results, stream, writer } = rig(2_000);
    stream.onAdd = (cmdId) => {
      results.map.set(cmdId, FAILED);
      writer.notify(cmdId);
    };
    const e = await rejects(writer.submit(req()));
    expect(e.original.code).toBe('common.postgres_unavailable');
    expect(e.original.status).toBe(503);
  });

  it('XADD 실패(Redis 불가) → 503 common.postgres_unavailable · unavailable 계수 · 대기 맵 해제 · 원장 우회 없음', async () => {
    const { stream, writer } = rig(5_000);
    stream.fail = true;
    const before = await counter('alarm.rule.create', 'unavailable');
    const t0 = Date.now();
    const e = await rejects(writer.submit(req({ kind: 'alarm.rule.create', idempotencyKey: KEY })));
    expect(Date.now() - t0).toBeLessThan(1_000); // 대기 상한까지 기다리지 않는다
    expect(e).toBeInstanceOf(BizWriteError);
    expect(e.cmdId).toBe(KEY);
    expect(e.original.code).toBe('common.postgres_unavailable');
    expect(e.original.status).toBe(503);
    expect(await counter('alarm.rule.create', 'unavailable')).toBe(before + 1);
    expect(writer.pendingCount()).toBe(0);
  });

  it('다른 인스턴스의 cmdId 알림은 버린다 · 채널로 거른다', async () => {
    const { writer } = rig(30);
    const handlers: ((ch: string, m: string) => void)[] = [];
    const sub = {
      on: (_ev: string, fn: (ch: string, m: string) => void) => handlers.push(fn),
      subscribe: async (ch: string) => {
        expect(ch).toBe(BIZ_REPLY_CHANNEL);
        return 1;
      },
    };
    writer.listen(sub as never);
    const w = writer.arm(KEY);
    handlers[0]?.('ch:flow', KEY); // 다른 채널
    handlers[0]?.(BIZ_REPLY_CHANNEL, KEY2); // 모르는 cmdId
    expect(writer.pendingCount()).toBe(1);
    handlers[0]?.(BIZ_REPLY_CHANNEL, KEY);
    expect(await w.done).toBe(true);
    expect(writer.pendingCount()).toBe(0);
  });
});

describe('같은 키 재요청(07_api/01 §업무 쓰기 경로)', () => {
  it('첫 판정이 결과 키에 있으면 XADD 없이 같은 응답 — 적용 · 거절', async () => {
    const { results, stream, writer } = rig(30);
    results.map.set(KEY, APPLIED);
    expect(await writer.submit(req({ idempotencyKey: KEY }))).toEqual({
      type: 'result',
      cmdId: KEY,
      httpStatus: 201,
      body: { siteId: 9 },
    });
    results.map.set(KEY2, REJECTED);
    const e = await rejects(writer.submit(req({ idempotencyKey: KEY2 })));
    expect(e.original.code).toBe('common.duplicate_key');
    expect(stream.adds).toHaveLength(0);
  });

  it('만료된 키 → 202 expired(XADD 없음) · 워커가 원장 EXPIRED로 답해도 202 expired', async () => {
    const { results, stream, writer } = rig(2_000);
    results.map.set(KEY, EXPIRED);
    expect(await writer.submit(req({ idempotencyKey: KEY }))).toEqual({
      type: 'accepted',
      cmdId: KEY,
      status: 'expired',
    });
    expect(stream.adds).toHaveLength(0);
    // 결과 키가 사라진 뒤 — 다시 싣고 워커 ③이 원장 EXPIRED를 다시 낸다
    stream.onAdd = (cmdId) => {
      results.map.set(cmdId, EXPIRED);
      writer.notify(cmdId);
    };
    const before = await waitCount('expired');
    expect(await writer.submit(req({ idempotencyKey: KEY2 }))).toEqual({
      type: 'accepted',
      cmdId: KEY2,
      status: 'expired',
    });
    expect(stream.adds).toHaveLength(1);
    expect(await waitCount('expired')).toBe(before + 1);
  });

  it('첫 시도가 failed(503)면 다시 싣는다 — 워커가 원장을 다시 확인해 판정한다', async () => {
    const { results, stream, writer } = rig(2_000);
    results.map.set(KEY, FAILED);
    stream.onAdd = (cmdId) => {
      results.map.set(cmdId, APPLIED);
      writer.notify(cmdId);
    };
    expect(await writer.submit(req({ idempotencyKey: KEY }))).toMatchObject({
      type: 'result',
      httpStatus: 201,
    });
    expect(stream.adds).toHaveLength(1);
  });

  it('결과 키가 없으면(아직 pending) 같은 cmdId로 다시 싣고 같은 알림을 기다린다 · 결과 키 읽기 실패도 다시 싣는다', async () => {
    const { results, stream, writer } = rig(2_000);
    results.failed = true;
    stream.onAdd = (cmdId) => {
      results.failed = false;
      results.map.set(cmdId, APPLIED);
      writer.notify(cmdId);
    };
    await writer.submit(req({ idempotencyKey: KEY }));
    expect(BizCommandEnvelope.parse(JSON.parse(stream.adds[0]?.json ?? '{}')).cmdId).toBe(KEY);
  });

  it('같은 키 동시 요청 둘은 알림 하나로 함께 깬다', async () => {
    const { writer } = rig(2_000);
    const a = writer.arm(KEY);
    const b = writer.arm(KEY);
    expect(writer.pendingCount()).toBe(1);
    writer.notify(KEY);
    expect(await Promise.all([a.done, b.done])).toEqual([true, true]);
  });
});

// ── 명령 조회

describe('명령 조회 GET /api/v1/commands/{cmdId} — 결과 키 → 원장 → pending · status 5 · actor 404', () => {
  const fakeReq = {} as FastifyRequest;

  it('status 5 — applied · rejected · failed · expired · pending(본문 계약)', async () => {
    const { results, lookup } = rig();
    const c = new CommandsController(lookup);
    const ids = {
      applied: '00000000-0000-4000-8000-000000000001',
      rejected: '00000000-0000-4000-8000-000000000002',
      failed: '00000000-0000-4000-8000-000000000003',
      expired: '00000000-0000-4000-8000-000000000004',
      pending: '00000000-0000-4000-8000-000000000005',
    };
    results.map.set(ids.applied, APPLIED);
    results.map.set(ids.rejected, REJECTED);
    results.map.set(ids.failed, FAILED);
    results.map.set(ids.expired, EXPIRED);
    const bodies = Object.fromEntries(
      await Promise.all(
        Object.entries(ids).map(async ([k, id]) => [k, CommandStatusBody.parse(await c.get(id, fakeReq))]),
      ),
    );
    expect(bodies.applied).toEqual({
      cmdId: ids.applied,
      status: 'applied',
      httpStatus: 201,
      result: { siteId: 9 },
    });
    expect(bodies.rejected).toEqual({
      cmdId: ids.rejected,
      status: 'rejected',
      httpStatus: 409,
      error: REJECTED.error,
    });
    expect(bodies.failed).toEqual({
      cmdId: ids.failed,
      status: 'failed',
      httpStatus: 503,
      error: FAILED.error,
    });
    expect(bodies.expired).toEqual({ cmdId: ids.expired, status: 'expired' });
    expect(bodies.pending).toEqual({ cmdId: ids.pending, status: 'pending' });
  });

  it('결과 키가 없으면 원장 — 컬럼 status · actor가 정본 · 결과 키 읽기 실패도 원장으로', async () => {
    const { results, ledger, lookup } = rig();
    const c = new CommandsController(lookup);
    ledger.rows.set(KEY, { status: 'EXPIRED', actor: null, result: { status: 'EXPIRED', actor: null } });
    ledger.rows.set(KEY2, { status: 'REJECTED', actor: null, result: REJECTED });
    results.failed = true;
    expect(await c.get(KEY, fakeReq)).toEqual({ cmdId: KEY, status: 'expired' });
    expect(await c.get(KEY2, fakeReq)).toMatchObject({ status: 'rejected', httpStatus: 409 });
  });

  it('actor 불일치 → 404 common.not_found(결과 키 · 원장) · 둘 다 NULL이면 같다', async () => {
    const { results, ledger, lookup } = rig();
    const c = new CommandsController(lookup);
    results.map.set(KEY, { ...APPLIED, actor: 42 });
    ledger.rows.set(KEY2, { status: 'APPLIED', actor: 42, result: { ...APPLIED, actor: 42 } });
    for (const id of [KEY, KEY2]) {
      const e = await rejects(c.get(id, fakeReq));
      expect((e as unknown as ApiError).code).toBe('common.not_found');
      expect((e as unknown as ApiError).status).toBe(404);
    }
  });

  it('UUID가 아니면 400 path.cmdId format · 원장 불가는 503', async () => {
    const { ledger, lookup } = rig();
    const c = new CommandsController(lookup);
    const bad = (await rejects(c.get('abc', fakeReq))) as unknown as ApiError;
    expect(bad.code).toBe('common.validation_failed');
    expect(bad.details).toEqual({ fields: [{ path: 'path.cmdId', reason: 'format' }] });
    ledger.down = true;
    const down = (await rejects(c.get(KEY, fakeReq))) as unknown as ApiError;
    expect(down.code).toBe('common.postgres_unavailable');
  });
});

// ── DirectBizWriter

class FakeHandlers implements BizHandlers {
  readonly calls: { env: unknown; ledger: boolean }[] = [];
  next: (() => Promise<BizApplyOutcome>) | null = null;
  async apply(env: never, opts: { ledger: boolean }): Promise<BizApplyOutcome> {
    this.calls.push({ env, ledger: opts.ledger });
    if (this.next) return this.next();
    return {
      httpStatus: 201,
      body: { siteId: 9 },
      trace: { txMs: 3, invalidateMs: 1, invalidatedKeys: 2, cacheinv: true },
    };
  }
}

function fakeFlow(enabled = true) {
  const published: FlowBizInput[] = [];
  const flow = { enabled: () => enabled, publishBiz: (i: FlowBizInput) => published.push(i) };
  return { flow: flow as unknown as FlowPublisher, published };
}

describe('DirectBizWriter — 옛 경로(ledger false · 헤더 없음 · 흐름 요약 role api-direct)', () => {
  it('적용 서비스를 ledger false로 직접 부르고 cmdId null(헤더 되싣지 않음) · 요약 1건', async () => {
    const h = new FakeHandlers();
    const { flow, published } = fakeFlow();
    const w = new DirectBizWriter(h, flow);
    const out = await w.submit(req({ idempotencyKey: KEY }));
    expect(out).toEqual({ type: 'result', cmdId: null, httpStatus: 201, body: { siteId: 9 } });
    expect(h.calls[0]?.ledger).toBe(false);
    expect(published).toEqual([
      {
        role: 'api-direct',
        cmdId: null,
        kind: 'master.site.create',
        result: 'ok',
        duplicate: false,
        stages: { queueWaitMs: null, txMs: 3, invalidateMs: 1, replyMs: null },
        invalidatedKeys: 2,
        cacheinv: true,
      },
    ]);
  });

  it('도메인 거절은 같은 ApiError를 그대로(BizWriteError 아님) · 결과 코드로 요약 · 표지 없으면 요약 없음', async () => {
    const h = new FakeHandlers();
    h.next = async () => {
      throw new ApiError('common.duplicate_key', '같은 코드가 이미 있다', { field: 'siteCode' });
    };
    const { flow, published } = fakeFlow();
    const e = await rejects(new DirectBizWriter(h, flow).submit(req()));
    expect(e).not.toBeInstanceOf(BizWriteError);
    expect((e as unknown as ApiError).code).toBe('common.duplicate_key');
    expect(published[0]?.result).toBe('common.duplicate_key');
    const off = fakeFlow(false);
    await rejects(new DirectBizWriter(h, off.flow).submit(req()));
    expect(off.published).toHaveLength(0);
  });
});

describe('SW-12 주입 — 모듈 초기화 때 한 번 고르고 등록한다', () => {
  it('stream(기본) → StreamBizWriter + ch:bizreply 구독 · direct → DirectBizWriter', () => {
    const regs: [string, string | number, string][] = [];
    const reg = { register: (id: string, v: string | number, impl: string) => regs.push([id, v, impl]) };
    const subscribed: string[] = [];
    const conns = {
      subscriberConnection: () => ({
        on: () => undefined,
        subscribe: async (ch: string) => subscribed.push(ch),
      }),
    };
    const { stream, lookup } = rig();
    const { flow } = fakeFlow();
    const make = (v?: string) =>
      bizWritePortFactory(
        loadConfig({ WORKER_POOL_SIZE: '1', ...(v ? { BIZ_WRITE_PATH: v } : {}) }),
        reg as unknown as SwitchRegistry,
        stream.asDurable(),
        conns as unknown as RedisConnections,
        lookup,
        new FakeHandlers(),
        flow,
      );
    expect(make().implName).toBe('StreamBizWriter');
    expect(subscribed).toEqual([BIZ_REPLY_CHANNEL]);
    expect(make('direct').implName).toBe('DirectBizWriter');
    expect(regs).toEqual([
      ['SW-12', 'stream', 'StreamBizWriter'],
      ['SW-12', 'direct', 'DirectBizWriter'],
    ]);
  });
});

// ── Idempotency-Key · 컨트롤러

class FakePort implements BizWritePort {
  readonly implName = 'StreamBizWriter' as const;
  readonly calls: BizWriteRequest[] = [];
  next: (r: BizWriteRequest) => Promise<BizWriteOutcome> = async (r) => ({
    type: 'result',
    cmdId: r.idempotencyKey ?? KEY,
    httpStatus: 201,
    body: { ok: true },
  });
  submit(r: BizWriteRequest) {
    this.calls.push(r);
    return this.next(r);
  }
}

function fakeReply() {
  const headers: Record<string, string> = {};
  let status: number | null = null;
  const reply = {
    header(k: string, v: string) {
      headers[k] = v;
      return reply;
    },
    status(s: number) {
      status = s;
      return reply;
    },
  };
  return { reply: reply as unknown as FastifyReply, headers, status: () => status };
}

const reqWith = (key?: string | string[]) =>
  ({ headers: key === undefined ? {} : { [IDEMPOTENCY_HEADER]: key } }) as unknown as FastifyRequest;

describe('Idempotency-Key — 형식 검사 · 응답 헤더 되싣기', () => {
  it('UUID가 아니면 400 header.idempotency-key format · 없으면 null · 대문자는 소문자로', () => {
    expect(idempotencyKeyOf(reqWith())).toBeNull();
    expect(idempotencyKeyOf(reqWith(KEY.toUpperCase()))).toBe(KEY);
    try {
      idempotencyKeyOf(reqWith('abc'));
      throw new Error('통과했다');
    } catch (e) {
      expect((e as ApiError).code).toBe('common.validation_failed');
      expect((e as ApiError).details).toEqual({
        fields: [{ path: 'header.idempotency-key', reason: 'format' }],
      });
    }
  });

  it('결과 → 상태 코드 · 본문 · 헤더 / 202 → {cmdId, status} · 헤더 / direct(cmdId null) → 헤더 없음', async () => {
    const port = new FakePort();
    let r = fakeReply();
    expect(await submitWrite(port, reqWith(KEY), r.reply, 'master.site.create', {}, {})).toEqual({
      ok: true,
    });
    expect(r.status()).toBe(201);
    expect(r.headers[IDEMPOTENCY_HEADER]).toBe(KEY);

    port.next = async () => ({ type: 'accepted', cmdId: KEY2, status: 'pending' });
    r = fakeReply();
    expect(await submitWrite(port, reqWith(), r.reply, 'master.site.create', {}, {})).toEqual({
      cmdId: KEY2,
      status: 'pending',
    });
    expect(r.status()).toBe(202);
    expect(r.headers[IDEMPOTENCY_HEADER]).toBe(KEY2);

    port.next = async () => ({ type: 'result', cmdId: null, httpStatus: 200, body: {} });
    r = fakeReply();
    await submitWrite(port, reqWith(KEY), r.reply, 'master.site.patch', { id: 1 }, {});
    expect(r.status()).toBe(200);
    expect(r.headers[IDEMPOTENCY_HEADER]).toBeUndefined();
  });

  it('BizWriteError → 헤더를 싣고 원 ApiError를 던진다', async () => {
    const port = new FakePort();
    port.next = async () => {
      throw new BizWriteError(new ApiError('common.duplicate_key', 'dup', { field: 'siteCode' }), KEY);
    };
    const r = fakeReply();
    const e = await rejects(submitWrite(port, reqWith(), r.reply, 'master.site.create', {}, {}));
    expect(e).not.toBeInstanceOf(BizWriteError);
    expect((e as unknown as ApiError).code).toBe('common.duplicate_key');
    expect(r.headers[IDEMPOTENCY_HEADER]).toBe(KEY);
  });
});

describe('쓰기 표면 14 → 포트(kind · params · body) · 검증은 포트 전에 끝난다', () => {
  const port = new FakePort();
  const master = new MasterController({} as MasterReadService, port);
  const alarm = new AlarmApiController(
    {} as AlarmEventsService,
    {} as AlarmRulesService,
    {} as AlarmEvalsService,
    port,
  );
  it('각 표면이 자기 kind 하나 · 경로 식별자는 params.id', async () => {
    const q = reqWith();
    const run = async (fn: (res: FastifyReply) => Promise<unknown> | unknown) => fn(fakeReply().reply);
    await run((res) => master.deactivate('7', q, res));
    await run((res) => master.patchSite('2', { siteName: '구미2' }, q, res));
    await run((res) =>
      master.putModbus(
        '3',
        { host: '127.0.0.1', port: 502, unitId: 1, timeoutMs: 1000, retryCount: 1, maxRegsPerRequest: 100 },
        q,
        res,
      ),
    );
    await run((res) => alarm.ack('42', q, res));
    await run((res) => alarm.patchRule('5', { enabled: false }, q, res));
    expect(port.calls.map((c) => [c.kind, c.params])).toEqual([
      ['master.tag.deactivate', { id: 7 }],
      ['master.site.patch', { id: 2 }],
      ['master.modbus.put', { id: 3 }],
      ['alarm.event.ack', { id: 42 }],
      ['alarm.rule.patch', { id: 5 }],
    ]);
    expect(port.calls[0]?.body).toBeUndefined();
    expect(port.calls[1]?.body).toEqual({ siteName: '구미2' });
  });

  it('본문 검증 실패 · 경로 식별자 위반은 400이고 포트를 부르지 않는다(명령이 되지 않는다)', async () => {
    const n = port.calls.length;
    expect(() => master.createSite({ siteCode: 1 }, reqWith(), fakeReply().reply)).toThrow(ApiError);
    expect(() => master.patchTag('abc', {}, reqWith(), fakeReply().reply)).toThrow(ApiError);
    expect(() => alarm.ack('0', reqWith(), fakeReply().reply)).toThrow(ApiError);
    expect(port.calls.length).toBe(n);
  });
});

// ── 표면 응답(Nest + Fastify · 에러 봉투 필터)

@Controller('t')
class ProbeController {
  constructor(@Inject(BIZ_WRITE_PORT) private readonly port: BizWritePort) {}
  @Post('w')
  w(@Body() b: unknown, @Req() req: FastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    return submitWrite(this.port, req, res, 'master.site.create', {}, b);
  }
}

describe('표면 응답 — 상태 코드 · Idempotency-Key 헤더 · 에러 봉투 불변', () => {
  const port = new FakePort();
  let app: NestFastifyApplication;

  beforeAll(async () => {
    @Module({ controllers: [ProbeController], providers: [{ provide: BIZ_WRITE_PORT, useValue: port }] })
    class ProbeModule {}
    app = await NestFactory.create<NestFastifyApplication>(ProbeModule, new FastifyAdapter(), {
      logger: false,
    });
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await app.close();
  });

  const post = (headers: Record<string, string> = {}) =>
    app
      .getHttpAdapter()
      .getInstance()
      .inject({ method: 'POST', url: '/t/w', payload: { a: 1 }, headers });

  it('적용 201 · 헤더 되싣기', async () => {
    port.next = async (r) => ({
      type: 'result',
      cmdId: r.idempotencyKey ?? KEY2,
      httpStatus: 201,
      body: { siteId: 9 },
    });
    const r = await post({ [IDEMPOTENCY_HEADER]: KEY });
    expect(r.statusCode).toBe(201);
    expect(r.headers[IDEMPOTENCY_HEADER]).toBe(KEY);
    expect(r.json()).toEqual({ siteId: 9 });
  });

  it('202 pending 본문 · 헤더', async () => {
    port.next = async () => ({ type: 'accepted', cmdId: KEY2, status: 'pending' });
    const r = await post();
    expect(r.statusCode).toBe(202);
    expect(r.headers[IDEMPOTENCY_HEADER]).toBe(KEY2);
    expect(r.json()).toEqual({ cmdId: KEY2, status: 'pending' });
  });

  it('도메인 거절 409 · 503 — 에러 봉투 그대로 + 헤더', async () => {
    port.next = async () => {
      throw new BizWriteError(new ApiError('common.duplicate_key', 'dup', { field: 'siteCode' }), KEY);
    };
    const r = await post({ [IDEMPOTENCY_HEADER]: KEY });
    expect(r.statusCode).toBe(409);
    expect(r.headers[IDEMPOTENCY_HEADER]).toBe(KEY);
    expect(ErrorEnvelope.parse(r.json()).error).toEqual({
      code: 'common.duplicate_key',
      message: 'dup',
      details: { field: 'siteCode' },
    });
    port.next = async () => {
      throw new BizWriteError(new ApiError('common.postgres_unavailable', 'down'), KEY);
    };
    const d = await post();
    expect(d.statusCode).toBe(503);
    expect(d.json().error.code).toBe('common.postgres_unavailable');
  });

  it('Idempotency-Key 형식 위반 400 · 헤더 없음', async () => {
    const r = await post({ [IDEMPOTENCY_HEADER]: 'not-a-uuid' });
    expect(r.statusCode).toBe(400);
    expect(r.json().error.details.fields).toEqual([{ path: 'header.idempotency-key', reason: 'format' }]);
    expect(r.headers[IDEMPOTENCY_HEADER]).toBeUndefined();
  });
});
