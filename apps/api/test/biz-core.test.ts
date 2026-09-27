// 업무 명령 적용 쪽 — 명령 워커 단계 ②~⑦ · 멱등 표 6경우 · 단일 소비자 락 · BizHandlers 원장 같은 트랜잭션(06_pipeline/07 §업무 명령 경로)
// 가짜 deps로 단계 순서(결과 SET → 알림 → XACK)와 원장 · 결과 키의 갈래를 본다. 저장소는 띄우지 않는다.
import { randomUUID } from 'node:crypto';
import { BIZ_RESULT_TTL_S, type BizCommandEnvelopeBody, type BizResultBody } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import type { ClickHouse } from '../src/common/clickhouse/clickhouse.module';
import type { FlowBizInput } from '../src/common/flow/flow-publisher';
import { ApiError } from '../src/common/http/api-error';
import type { Postgres } from '../src/common/postgres/postgres.module';
import type { CacheKeyClient } from '../src/common/redis/cache-key-client';
import type { FanoutPublisher } from '../src/common/redis/fanout-publisher';
import type { AlarmEventsService } from '../src/modules/alarm/api/alarm-events.service';
import type { AlarmRulesService } from '../src/modules/alarm/api/alarm-rules.service';
import type { BizApplyOutcome, BizHandlers } from '../src/modules/biz/biz-contracts';
import { BizHandlersImpl } from '../src/modules/biz/biz-handlers';
import { BizLedgerConflict, type LedgerKey, type LedgerRow } from '../src/modules/biz/biz-ledger';
import { BizCommandRunner, type BizWorkerDeps } from '../src/modules/biz/biz-worker';
import { InvalidationChain } from '../src/modules/master/invalidation-chain';
import { MasterWriteService } from '../src/modules/master/master-write.service';

const NOW = 1_800_000_000_000;

function envelope(over: Partial<BizCommandEnvelopeBody> = {}): BizCommandEnvelopeBody {
  return {
    cmdId: randomUUID(),
    kind: 'master.site.create',
    payload: { params: {}, body: { siteCode: 'S9', siteName: '시험' } },
    actor: 7,
    requestedAt: NOW - 20,
    ...over,
  };
}

const trace = { txMs: 3, invalidateMs: 1, invalidatedKeys: 1, cacheinv: true };

/** 가짜 워커 세계 — 원장 · 결과 키 · 스트림(PEL · 새 명령) · 락 · 사건 순서 로그 */
function world(
  opts: {
    apply?: (env: BizCommandEnvelopeBody) => Promise<BizApplyOutcome>;
    pgDown?: boolean;
    recordDown?: boolean;
    lockFree?: boolean;
    flowOn?: boolean;
  } = {},
) {
  const log: string[] = [];
  const ledger = new Map<string, LedgerRow>();
  const results = new Map<string, BizResultBody>();
  const pel: { id: string; value: string | null }[] = [];
  const fresh: { id: string; value: string | null }[] = [];
  const reads: string[] = [];
  const flow: FlowBizInput[] = [];
  let lockOwner: string | null = opts.lockFree === false ? 'other' : null;
  let applied = 0;
  const handlers: BizHandlers = {
    apply: async (env) => {
      applied++;
      log.push(`APPLY ${env.cmdId}`);
      if (opts.apply) return opts.apply(env);
      log.push('CHAIN');
      return { httpStatus: 201, body: { siteId: 1 }, trace };
    },
  };
  const deps: BizWorkerDeps = {
    handlers,
    ledger: {
      find: async (cmdId) => {
        if (opts.pgDown) throw new ApiError('common.postgres_unavailable', 'x');
        return ledger.get(cmdId) ?? null;
      },
      record: async (key: LedgerKey, status, result) => {
        if (opts.recordDown || opts.pgDown) throw new ApiError('common.postgres_unavailable', 'x');
        if (ledger.has(key.cmdId)) return 'conflict';
        ledger.set(key.cmdId, { status, result, actor: key.actor });
        log.push(`LEDGER ${status}`);
        return 'inserted';
      },
    },
    results: {
      set: async (cmdId, json, ttl) => {
        expect(ttl).toBe(BIZ_RESULT_TTL_S);
        results.set(cmdId, JSON.parse(json) as BizResultBody);
        log.push('SET');
        return true;
      },
    },
    lock: {
      acquire: async () => {
        if (lockOwner) return { token: null, failed: false };
        lockOwner = 'me';
        return { token: 'me', failed: false };
      },
      renew: async (token) => lockOwner === token,
      release: async (token) => {
        if (lockOwner === token) lockOwner = null;
      },
    },
    stream: {
      ensureGroup: async () => {
        log.push('GROUP');
      },
      read: async (fromId) => {
        reads.push(fromId);
        if (fromId === '>') return fresh.splice(0);
        const i = fromId === '0' ? 0 : pel.findIndex((e) => e.id === fromId) + 1;
        return pel.slice(i);
      },
      ack: async (id) => {
        log.push(`XACK ${id}`);
        const i = pel.findIndex((e) => e.id === id);
        if (i >= 0) pel.splice(i, 1);
      },
      backlog: async () => ({ lag: 0, pending: pel.length }),
    },
    reply: async (cmdId) => {
      log.push(`PUBLISH ${cmdId}`);
      return true;
    },
    flow: {
      enabled: () => opts.flowOn ?? true,
      publishBiz: (i) => {
        log.push('FLOW');
        flow.push(i);
      },
    },
    now: () => NOW,
    log: { log: () => {}, warn: () => {}, error: () => {} },
  };
  const runner = new BizCommandRunner(deps);
  return {
    runner,
    log,
    ledger,
    results,
    pel,
    fresh,
    reads,
    flow,
    applied: () => applied,
    steal: () => {
      lockOwner = 'other';
    },
  };
}

const entry = (env: BizCommandEnvelopeBody, id = '1-0') => ({ id, value: JSON.stringify(env) });

describe('명령 워커 — 멱등 표 6경우', () => {
  it('첫 전달 — 적용 · 결과 SET → 알림 → XACK → 흐름 요약(⑥ 체인이 ⑦보다 앞)', async () => {
    const w = world();
    const env = envelope();
    await w.runner.process('1-0', entry(env).value);
    expect(w.log).toEqual([`APPLY ${env.cmdId}`, 'CHAIN', 'SET', `PUBLISH ${env.cmdId}`, 'XACK 1-0', 'FLOW']);
    expect(w.results.get(env.cmdId)).toEqual({
      status: 'APPLIED',
      actor: 7,
      httpStatus: 201,
      body: { siteId: 1 },
    });
    expect(w.flow[0]).toMatchObject({
      role: 'biz-writer',
      cmdId: env.cmdId,
      kind: 'master.site.create',
      result: 'ok',
      duplicate: false,
      invalidatedKeys: 1,
      cacheinv: true,
      stages: { queueWaitMs: 20, txMs: 3, invalidateMs: 1 },
    });
  });

  it('도메인 오류 — 별도 트랜잭션 REJECTED 행 · 결과에 오류 코드(HTTP 상태 불변)', async () => {
    const w = world({
      apply: async () => {
        throw Object.assign(new ApiError('common.duplicate_key', '중복', { field: 'siteCode' }), {
          trace: { ...trace, txMs: 2, invalidateMs: null, invalidatedKeys: 0, cacheinv: false },
        });
      },
    });
    const env = envelope();
    await w.runner.process('1-0', entry(env).value);
    const r = w.results.get(env.cmdId);
    expect(r).toEqual({
      status: 'REJECTED',
      actor: 7,
      httpStatus: 409,
      error: { code: 'common.duplicate_key', message: '중복', details: { field: 'siteCode' } },
    });
    expect(w.ledger.get(env.cmdId)?.status).toBe('REJECTED');
    expect(w.log.slice(1)).toEqual(['LEDGER REJECTED', 'SET', `PUBLISH ${env.cmdId}`, 'XACK 1-0', 'FLOW']);
    expect(w.flow[0]).toMatchObject({
      result: 'common.duplicate_key',
      stages: { txMs: 2, invalidateMs: null },
    });
  });

  it('재전달 · 같은 cmdId 재요청 — 원장 행이 있으면 적용 없이 저장된 결과를 다시 SET · 알림', async () => {
    const w = world();
    const env = envelope();
    const stored: BizResultBody = { status: 'APPLIED', actor: 7, httpStatus: 201, body: { siteId: 5 } };
    w.ledger.set(env.cmdId, { status: 'APPLIED', result: stored, actor: 7 });
    await w.runner.process('2-0', entry(env).value);
    expect(w.applied()).toBe(0);
    expect(w.results.get(env.cmdId)).toEqual(stored);
    expect(w.log).toEqual(['SET', `PUBLISH ${env.cmdId}`, 'XACK 2-0', 'FLOW']);
    expect(w.flow[0]).toMatchObject({
      duplicate: true,
      result: 'ok',
      stages: { txMs: null, invalidateMs: null },
    });
  });

  it('커밋 뒤 결과 SET 전 크래시 — 재전달이 ③에서 저장된 결과(이중 적용 없음)', async () => {
    const w = world();
    const env = envelope();
    // 첫 전달이 커밋(원장 APPLIED)까지 하고 죽었다 — 결과 키 · XACK 없음 → PEL에 남는다
    w.ledger.set(env.cmdId, {
      status: 'APPLIED',
      result: { status: 'APPLIED', actor: 7, httpStatus: 201, body: { siteId: 1 } },
      actor: 7,
    });
    w.pel.push(entry(env, '3-0'));
    expect(await w.runner.step()).toBe(true);
    expect(w.applied()).toBe(0);
    expect(w.results.get(env.cmdId)?.status).toBe('APPLIED');
    expect(w.pel).toHaveLength(0);
  });

  it('PostgreSQL 불가 — 재시도 없이 결과 키에만 FAILED 503 · 원장 행 없음 · XACK', async () => {
    const w = world({ pgDown: true });
    const env = envelope();
    await w.runner.process('4-0', entry(env).value);
    expect(w.applied()).toBe(0);
    expect(w.ledger.size).toBe(0);
    expect(w.results.get(env.cmdId)).toEqual({
      status: 'FAILED',
      actor: 7,
      httpStatus: 503,
      error: { code: 'common.postgres_unavailable', message: 'PostgreSQL에 접속할 수 없다' },
    });
    expect(w.log).toContain('XACK 4-0');
    expect(w.flow[0]).toMatchObject({ result: 'common.postgres_unavailable', duplicate: false });
  });

  it('PostgreSQL 불가(적용 중) — 트랜잭션이 postgres_unavailable이면 FAILED · 원장 행 없음', async () => {
    const w = world({
      apply: async () => {
        throw new ApiError('common.postgres_unavailable', 'x');
      },
    });
    const env = envelope();
    await w.runner.process('4-1', entry(env).value);
    expect(w.results.get(env.cmdId)?.status).toBe('FAILED');
    expect(w.ledger.size).toBe(0);
  });

  it('만료 뒤 같은 cmdId 재요청 — EXPIRED 행이 있으면 적용 없이 저장된 결과({status: EXPIRED} · httpStatus 없음)', async () => {
    const w = world();
    const env = envelope();
    w.ledger.set(env.cmdId, { status: 'EXPIRED', result: { status: 'EXPIRED', actor: 7 }, actor: 7 });
    await w.runner.process('5-0', entry(env).value);
    expect(w.applied()).toBe(0);
    expect(w.results.get(env.cmdId)).toEqual({ status: 'EXPIRED', actor: 7 });
    expect(w.flow[0]).toMatchObject({ result: 'expired', duplicate: true });
  });
});

describe('명령 워커 — 유효 창 · 원장 충돌', () => {
  it('유효 창(결과 키 TTL) 초과 — 적용하지 않고 EXPIRED 행 · 결과 SET · XACK', async () => {
    const w = world();
    const env = envelope({ requestedAt: NOW - BIZ_RESULT_TTL_S * 1000 - 1 });
    await w.runner.process('6-0', entry(env).value);
    expect(w.applied()).toBe(0);
    expect(w.ledger.get(env.cmdId)).toEqual({
      status: 'EXPIRED',
      result: { status: 'EXPIRED', actor: 7 },
      actor: 7,
    });
    expect(w.results.get(env.cmdId)).toEqual({ status: 'EXPIRED', actor: 7 });
    expect(w.log).toEqual(['LEDGER EXPIRED', 'SET', `PUBLISH ${env.cmdId}`, 'XACK 6-0', 'FLOW']);
  });

  it('유효 창 경계 안(= 창)이면 적용한다', async () => {
    const w = world();
    await w.runner.process('6-1', entry(envelope({ requestedAt: NOW - BIZ_RESULT_TTL_S * 1000 })).value);
    expect(w.applied()).toBe(1);
  });

  it('만료 판정을 원장에 못 쓰면(PostgreSQL 불가) FAILED — 원장 없이 만료를 확정하지 않는다', async () => {
    const w = world({ recordDown: true });
    const env = envelope({ requestedAt: 0 });
    await w.runner.process('6-2', entry(env).value);
    expect(w.results.get(env.cmdId)?.status).toBe('FAILED');
  });

  it('거절 행을 못 쓰면 결과 키에만 REJECTED — 같은 키 재요청이 판정을 다시 계산한다', async () => {
    const w = world({
      recordDown: true,
      apply: async () => {
        throw new ApiError('common.not_found', '없다');
      },
    });
    const env = envelope();
    await w.runner.process('6-3', entry(env).value);
    expect(w.results.get(env.cmdId)).toMatchObject({ status: 'REJECTED', httpStatus: 404 });
    expect(w.ledger.size).toBe(0);
  });

  it('APPLIED INSERT UNIQUE 충돌(겹친 워커) — 롤백 · 저장된 판정을 낸다(duplicate)', async () => {
    const env = envelope();
    const w = world({
      apply: async (e) => {
        w.ledger.set(e.cmdId, {
          status: 'APPLIED',
          result: { status: 'APPLIED', actor: 7, httpStatus: 201, body: { siteId: 3 } },
          actor: 7,
        });
        throw new BizLedgerConflict(e.cmdId);
      },
    });
    await w.runner.process('7-0', entry(env).value);
    expect(w.results.get(env.cmdId)).toMatchObject({ status: 'APPLIED', body: { siteId: 3 } });
    expect(w.flow[0]).toMatchObject({ duplicate: true, stages: { txMs: null } });
  });

  it('모르는 kind — REJECTED(validation) 원장 없이도 결과를 낸다 · cmdId를 읽을 수 없으면 XACK만', async () => {
    const w = world();
    const cmdId = randomUUID();
    await w.runner.process('8-0', JSON.stringify({ ...envelope({ cmdId }), kind: 'master.nope' }));
    expect(w.applied()).toBe(0);
    expect(w.results.get(cmdId)).toMatchObject({ status: 'REJECTED', httpStatus: 400 });
    await w.runner.process('8-1', 'not json');
    await w.runner.process('8-2', null);
    expect(w.log.filter((l) => l.startsWith('XACK'))).toEqual(['XACK 8-0', 'XACK 8-1', 'XACK 8-2']);
  });

  it('구독 표지가 없으면 흐름 요약을 만들지 않는다', async () => {
    const w = world({ flowOn: false });
    await w.runner.process('9-0', entry(envelope()).value);
    expect(w.flow).toHaveLength(0);
  });
});

describe('명령 워커 — 단일 소비자 락 · PEL 우선', () => {
  it('락을 못 쥐면 읽지 않는다(false — 재시도 주기 대기)', async () => {
    const w = world({ lockFree: false });
    w.fresh.push(entry(envelope()));
    expect(await w.runner.step()).toBe(false);
    expect(w.reads).toEqual([]);
    expect(w.applied()).toBe(0);
  });

  it('쥐면 그룹 보장 → 자기 PEL(ID 0)을 먼저 소진한 뒤 > 로 읽는다', async () => {
    const w = world();
    const old = envelope();
    const next = envelope();
    w.pel.push(entry(old, '1-0'));
    w.fresh.push(entry(next, '2-0'));
    await w.runner.step();
    await w.runner.step();
    await w.runner.step();
    expect(w.reads).toEqual(['0', '1-0', '>']);
    expect(w.log[0]).toBe('GROUP');
    const applies = w.log.filter((l) => l.startsWith('APPLY'));
    expect(applies).toEqual([`APPLY ${old.cmdId}`, `APPLY ${next.cmdId}`]);
  });

  it('락 상실(갱신 실패) — 다음 바퀴부터 소비하지 않는다 · 되찾으면 PEL부터 다시', async () => {
    const w = world();
    await w.runner.step();
    await w.runner.step(); // PEL 비어 > 로 넘어감
    expect(w.runner.holdsLock).toBe(true);
    w.steal();
    await w.runner.renewLock();
    expect(w.runner.holdsLock).toBe(false);
    w.fresh.push(entry(envelope()));
    const before = w.reads.length;
    expect(await w.runner.step()).toBe(false);
    expect(w.reads.length).toBe(before);
    expect(w.applied()).toBe(0);
  });

  it('처리 중 락을 잃으면 같은 묶음의 남은 명령은 PEL에 둔다', async () => {
    const w = world();
    const a = envelope();
    const b = envelope();
    w.pel.push(entry(a, '1-0'), entry(b, '2-0'));
    const inner = w.runner;
    // 첫 명령 적용 중 락이 넘어간다
    const orig = w.runner.process.bind(inner);
    let n = 0;
    inner.process = async (id, value) => {
      await orig(id, value);
      if (n++ === 0) {
        w.steal();
        await inner.renewLock();
      }
    };
    await inner.step();
    expect(w.applied()).toBe(1);
    expect(w.pel.map((e) => e.id)).toEqual(['2-0']);
  });

  it('stop — 락을 토큰 확인으로 해제한다', async () => {
    const w = world();
    await w.runner.step();
    await w.runner.stop();
    expect(w.runner.holdsLock).toBe(false);
  });
});

// ── BizHandlers — 원장 APPLIED가 업무 트랜잭션 안(COMMIT 직전) · trace

function pgHarness(opts: { ledgerConflict?: boolean } = {}) {
  const log: string[] = [];
  const client = {
    query: async (sql: string) => {
      const s = sql.replace(/\s+/g, ' ').trim();
      log.push(s.split(' ').slice(0, 3).join(' '));
      if (/^INSERT INTO site/.test(s))
        return {
          rowCount: 1,
          rows: [{ site_id: 11, site_code: 'S9', site_name: '시험', timezone: 'Asia/Seoul' }],
        };
      if (/^INSERT INTO tag_master /.test(s)) return { rowCount: 1, rows: [{ tag_id: 100 }] };
      if (/FROM tag_master WHERE tag_id/.test(s))
        return {
          rowCount: 1,
          rows: [
            {
              tag_id: 100,
              device_id: 1,
              tag_code: 'T',
              tag_name: 'n',
              function_code: 3,
              address: 1,
              data_type: 'INT16',
              word_order: null,
              scale: 1,
              offset_value: 0,
              unit: '',
              deadband: 0,
              scan_rate_ms: 1000,
              range_min: null,
              range_max: null,
              is_active: true,
            },
          ],
        };
      if (/^INSERT INTO biz_command_log/.test(s) && opts.ledgerConflict)
        throw Object.assign(new Error('dup'), { code: '23505', constraint: 'biz_command_log_cmd_id_key' });
      return { rowCount: 1, rows: [] };
    },
    release: () => {},
  };
  const pg = { pool: { connect: async () => client } } as unknown as Postgres;
  const cache = {
    delTagMeta: async () => {
      log.push('DEL');
      return true;
    },
    delDevList: async () => true,
  } as unknown as CacheKeyClient;
  const fanout = {
    publishCacheInv: async () => {
      log.push('PUBLISH');
      return true;
    },
  } as unknown as FanoutPublisher;
  const ch = { client: { command: async () => undefined } } as unknown as ClickHouse;
  const master = new MasterWriteService(pg, new InvalidationChain(cache, fanout, ch));
  const handlers = new BizHandlersImpl(master, {} as AlarmRulesService, {} as AlarmEventsService);
  return { log, handlers };
}

describe('BizHandlers — 명령 하나 = 트랜잭션 하나', () => {
  it('ledger true — biz_command_log INSERT가 audit_log 뒤 · COMMIT 앞(같은 트랜잭션) · 201', async () => {
    const h = pgHarness();
    const out = await h.handlers.apply(envelope(), { ledger: true });
    expect(out.httpStatus).toBe(201);
    expect(out.body).toMatchObject({ siteId: 11 });
    expect(h.log).toEqual([
      'BEGIN',
      'INSERT INTO site',
      'INSERT INTO audit_log',
      'INSERT INTO biz_command_log',
      'COMMIT',
    ]);
    expect(out.trace.txMs).not.toBeNull();
    expect(out.trace.invalidateMs).toBeNull();
  });

  it('ledger false(SW-12 direct) — 원장을 쓰지 않는다', async () => {
    const h = pgHarness();
    await h.handlers.apply(envelope(), { ledger: false });
    expect(h.log).not.toContain('INSERT INTO biz_command_log');
  });

  it('원장 UNIQUE 충돌 — 롤백 · BizLedgerConflict(도메인 오류 409로 바꾸지 않는다)', async () => {
    const h = pgHarness({ ledgerConflict: true });
    await expect(h.handlers.apply(envelope(), { ledger: true })).rejects.toBeInstanceOf(BizLedgerConflict);
    expect(h.log).toContain('ROLLBACK');
    expect(h.log).not.toContain('COMMIT');
  });

  it('태그 등록 — 체인 ②③이 반환 전 · trace에 지운 키 수 · 발행 여부', async () => {
    const h = pgHarness();
    const out = await h.handlers.apply(
      envelope({
        kind: 'master.tag.create',
        payload: {
          params: {},
          body: {
            deviceId: 1,
            tagCode: 'T',
            tagName: 'n',
            functionCode: 3,
            address: 1,
            dataType: 'INT16',
            wordOrder: null,
            scale: 1,
            offsetValue: 0,
            unit: '',
            deadband: 0,
            scanRateMs: 1000,
            rangeMin: null,
            rangeMax: null,
          },
        },
      }),
      { ledger: true },
    );
    expect(h.log.slice(-3)).toEqual(['COMMIT', 'DEL', 'PUBLISH']);
    expect(out.trace).toMatchObject({ invalidatedKeys: 1, cacheinv: true });
    expect(out.trace.invalidateMs).not.toBeNull();
  });

  it('도메인 오류 — ApiError에 trace가 붙는다(롤백까지 txMs)', async () => {
    const h = pgHarness();
    const err = await h.handlers
      .apply(
        envelope({ kind: 'master.site.patch', payload: { params: { id: 1 }, body: { timezone: 'UTC' } } }),
        {
          ledger: true,
        },
      )
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as { trace?: unknown }).trace).toBeDefined();
  });
});
