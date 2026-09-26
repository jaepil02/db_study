// S7 ① 알람 표면 — 표면 6 성공 · 실패 경로(07_api/07) · ACK 트랜잭션 ①~③ · 행위자 401/403 · 캐시 무효화 순서(커밋 전 DEL 금지).
// 가짜 풀 · 가짜 캐시 · 가짜 발행으로 SQL · 사건 순서를 본다(master-s4.test.ts와 같은 방식).
import { gzipSync } from 'node:zlib';
import {
  AlarmEvalQuery,
  AlarmEventListQuery,
  AlarmRuleCreateRequest,
  AlarmRulePatchRequest,
} from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import type { ClickHouse } from '../src/common/clickhouse/clickhouse.module';
import { ApiError, parseOrThrow } from '../src/common/http/api-error';
import { appRegistry } from '../src/common/metrics/registry';
import type { Postgres } from '../src/common/postgres/postgres.module';
import type { FanoutPublisher } from '../src/common/redis/fanout-publisher';
import { loadConfig } from '../src/config/app-config';
import {
  argon2idHasher,
  isArgon2idEncoded,
  SEED_LEARNER_EMAIL,
  SEED_ROLES,
  seedUserPassword,
} from '../src/db/seed-plan';
import { type AckActorResolver, EnvAckActorResolver } from '../src/modules/alarm/api/ack-actor';
import type { AlarmCacheOps } from '../src/modules/alarm/api/alarm-cache';
import { AlarmEvalsService, chooseEvalInterval } from '../src/modules/alarm/api/alarm-evals.service';
import {
  AlarmEventsService,
  buildListSql,
  decodeCursor,
  encodeCursor,
  eventsCacheField,
} from '../src/modules/alarm/api/alarm-events.service';
import { AlarmRulesService } from '../src/modules/alarm/api/alarm-rules.service';

const EVENT_ROW = {
  event_id: '42',
  rule_id: 3,
  tag_id: 7,
  tag_code: 'D1-T7',
  tag_name: '온도',
  tag_is_active: true,
  condition_type: 'GT',
  severity: 2,
  occurred_at: new Date('2026-09-26T01:00:00.000Z'),
  cleared_at: null,
  trigger_value: 81.5,
  state: 'ACTIVE',
  acked_by: null,
  acked_at: null,
  occurred_cursor: '2026-09-26T01:00:00.000000Z',
};
const RULE_ROW = {
  rule_id: 3,
  tag_id: 7,
  condition_type: 'GT',
  threshold: '80',
  threshold_low: null,
  debounce_ms: 5000,
  severity: 2,
  enabled: true,
};

interface World {
  /** 이벤트 행 — state · acked_at가 조건부 갱신의 판정 재료 */
  event: Record<string, unknown> | null;
  rule: Record<string, unknown> | null;
  tagActive: boolean | null;
  actor: { user_id: number; is_active: boolean; is_operator: boolean } | null;
  listRows: Record<string, unknown>[];
  failOn?: RegExp;
  pgDown?: boolean;
}

/** 가짜 풀 · 캐시 · 발행 — 사건 로그 하나에 SQL 머리 · COMMIT · DEL · PUBLISH를 순서대로 남긴다 */
function harness(w: Partial<World> = {}, email: string | null = SEED_LEARNER_EMAIL) {
  const world: World = {
    event: { ...EVENT_ROW },
    rule: { ...RULE_ROW },
    tagActive: true,
    actor: { user_id: 1, is_active: true, is_operator: true },
    listRows: [],
    ...w,
  };
  const log: string[] = [];
  const sqls: { sql: string; args: unknown[] }[] = [];
  const cacheStore = new Map<string, Buffer>();
  const cacheSets: { field: string; ttl: number }[] = [];
  const published: string[][] = [];
  const query = async (sql: string, args: unknown[] = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    log.push(s.split(' ').slice(0, 3).join(' '));
    sqls.push({ sql: s, args });
    if (world.pgDown) throw new Error('ECONNREFUSED');
    if (world.failOn?.test(s)) throw new Error('boom');
    if (/FROM user_account u WHERE u.email/.test(s))
      return { rowCount: world.actor ? 1 : 0, rows: world.actor ? [world.actor] : [] };
    if (/^UPDATE alarm_event SET acked_by/.test(s)) {
      const e = world.event;
      if (e && e.state === 'ACTIVE' && e.acked_at === null) {
        world.event = { ...e, acked_by: args[0], acked_at: new Date('2026-09-26T02:00:00.000Z') };
        return { rowCount: 1, rows: [world.event] };
      }
      return { rowCount: 0, rows: [] };
    }
    if (/^SELECT 1 FROM alarm_event/.test(s)) return { rowCount: world.event ? 1 : 0, rows: [] };
    if (/FROM alarm_event e .* WHERE e.event_id = \$1 AND e.occurred_at/.test(s))
      return { rowCount: 1, rows: [world.event] };
    if (/FROM alarm_event e/.test(s)) return { rowCount: world.listRows.length, rows: world.listRows };
    if (/FROM tag_master WHERE tag_id = \$1 FOR SHARE/.test(s))
      return world.tagActive === null
        ? { rowCount: 0, rows: [] }
        : { rowCount: 1, rows: [{ is_active: world.tagActive }] };
    if (/^INSERT INTO alarm_rule/.test(s))
      return {
        rowCount: 1,
        rows: [
          {
            rule_id: 9,
            tag_id: args[0],
            condition_type: args[1],
            threshold: String(args[2]),
            threshold_low: args[3] === null ? null : String(args[3]),
            debounce_ms: args[4],
            severity: args[5],
            enabled: args[6],
          },
        ],
      };
    if (/FROM alarm_rule WHERE rule_id = \$1 FOR UPDATE/.test(s))
      return { rowCount: world.rule ? 1 : 0, rows: world.rule ? [world.rule] : [] };
    if (/^UPDATE alarm_rule SET/.test(s)) {
      const sets = [...s.matchAll(/(\w+) = \$(\d+)/g)].filter(([, c]) => c !== 'rule_id');
      const next = { ...world.rule } as Record<string, unknown>;
      for (const [, col, n] of sets) next[col as string] = args[Number(n) - 1];
      world.rule = next;
      return { rowCount: 1, rows: [next] };
    }
    if (/FROM alarm_rule/.test(s)) return { rowCount: 1, rows: world.rule ? [world.rule] : [] };
    return { rowCount: 1, rows: [] };
  };
  const client = { query, release: () => {} };
  const pg = {
    pool: {
      connect: async () => {
        if (world.pgDown) throw new Error('ECONNREFUSED');
        return client;
      },
      query,
    },
  } as unknown as Postgres;
  const cache: AlarmCacheOps = {
    getAlarmEventsPage: async (f) => cacheStore.get(f) ?? null,
    setAlarmEventsPage: async (f, gz, ttl) => {
      cacheStore.set(f, gz);
      cacheSets.push({ field: f, ttl });
    },
    delAlarmEvents: async () => {
      log.push('DEL cache:alarmevents');
      cacheStore.clear();
      return true;
    },
    delAlarmRules: async () => {
      log.push('DEL cache:alarmrules');
      return true;
    },
  };
  const fanout = {
    publishCacheInv: async (keys: string[]) => {
      log.push('PUBLISH ch:cacheinv');
      published.push(keys);
      return true;
    },
  } as unknown as FanoutPublisher;
  const actor: AckActorResolver = new EnvAckActorResolver(
    loadConfig({ WORKER_POOL_SIZE: '1', ...(email ? { ALARM_ACK_ACTOR_EMAIL: email } : {}) }),
  );
  return {
    world,
    log,
    sqls,
    cacheStore,
    cacheSets,
    published,
    events: new AlarmEventsService(pg, cache, actor),
    rules: new AlarmRulesService(pg, cache, fanout),
    pg,
  };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : String(e);
  }
};
const at = (log: string[], x: string) => log.findIndex((l) => l.startsWith(x));
const listQ = (q: Record<string, string | undefined> = {}) => parseOrThrow(AlarmEventListQuery, q, 'query');
async function acks(result: string): Promise<number> {
  const m = await appRegistry.getSingleMetric('alm_acks_total')?.get();
  return m?.values.find((v) => v.labels.result === result)?.value ?? -1;
}

describe('#2 확인(ACK) — 트랜잭션 ①~③ · 커밋 뒤 DEL', () => {
  it('행위자 조회(첫 문장) → 조건부 UPDATE → 감사(user_id NULL) → COMMIT → DEL cache:alarmevents', async () => {
    const h = harness();
    const r = await h.events.ack(42);
    expect(r).toMatchObject({
      eventId: 42,
      ackedBy: 1,
      ackedAt: '2026-09-26T02:00:00.000Z',
      tagIsActive: true,
    });
    expect(h.log[0]).toBe('BEGIN');
    expect(h.log[1]).toBe('SELECT u.user_id, u.is_active,');
    expect(at(h.log, 'UPDATE alarm_event')).toBeLessThan(at(h.log, 'INSERT INTO audit_log'));
    expect(at(h.log, 'INSERT INTO audit_log')).toBeLessThan(at(h.log, 'COMMIT'));
    expect(at(h.log, 'COMMIT')).toBeLessThan(at(h.log, 'DEL cache:alarmevents'));
    expect(h.log).not.toContain('PUBLISH ch:cacheinv'); // 확인은 전파 신호가 없다(W6 판정)
    const auditSql = h.sqls.find((s) => s.sql.startsWith('INSERT INTO audit_log'));
    expect(auditSql?.sql).toContain('VALUES (NULL,');
    const [action, table, key, before = '', after = ''] = (auditSql?.args ?? []) as string[];
    expect([action, table, key]).toEqual(['UPDATE', 'alarm_event', '42']);
    expect(JSON.parse(before)).toMatchObject({ ackedBy: null, ackedAt: null, state: 'ACTIVE' });
    expect(JSON.parse(after)).toMatchObject({ ackedBy: 1, ackedAt: '2026-09-26T02:00:00.000Z' });
  });

  it('경합 — 두 번째 확인은 409 · 먼저 확인한 acked_by를 덮지 않는다 · 롤백 · DEL 없음', async () => {
    const h = harness();
    await h.events.ack(42);
    const first = h.world.event?.acked_by;
    h.log.length = 0;
    expect(await code(h.events.ack(42))).toBe('alarms.ack_not_allowed');
    expect(h.world.event?.acked_by).toBe(first);
    expect(h.log).toContain('ROLLBACK');
    expect(h.log).not.toContain('INSERT INTO audit_log');
    expect(h.log).not.toContain('DEL cache:alarmevents');
  });

  it('CLEARED 행 409 · 없는 id 404', async () => {
    const cleared = harness({ event: { ...EVENT_ROW, state: 'CLEARED', cleared_at: new Date() } });
    expect(await code(cleared.events.ack(42))).toBe('alarms.ack_not_allowed');
    expect(await code(harness({ event: null }).events.ack(42))).toBe('common.not_found');
  });

  it('행위자 — 환경변수 없음 · 계정 없음 · 비활성 401 · OPERATOR 없음 403 · 갱신 전에 멈춘다', async () => {
    const noEnv = harness({}, null);
    expect(await code(noEnv.events.ack(42))).toBe('auth.unauthenticated');
    expect(noEnv.log.some((l) => l.startsWith('UPDATE'))).toBe(false);
    expect(await code(harness({ actor: null }).events.ack(42))).toBe('auth.unauthenticated');
    const inactive = harness({ actor: { user_id: 1, is_active: false, is_operator: true } });
    expect(await code(inactive.events.ack(42))).toBe('auth.unauthenticated');
    const notOp = harness({ actor: { user_id: 1, is_active: true, is_operator: false } });
    expect(await code(notOp.events.ack(42))).toBe('auth.forbidden');
    expect(notOp.log.some((l) => l.startsWith('UPDATE'))).toBe(false);
    expect(notOp.world.event?.acked_by).toBeNull();
  });

  it('감사 실패는 확인 전체 롤백 · DEL 없음 · PostgreSQL 불가 503', async () => {
    const h = harness({ failOn: /^INSERT INTO audit_log/ });
    expect(await code(h.events.ack(42))).toBe('common.postgres_unavailable');
    expect(h.log).toContain('ROLLBACK');
    expect(h.log).not.toContain('DEL cache:alarmevents');
    expect(await code(harness({ pgDown: true }).events.ack(42))).toBe('common.postgres_unavailable');
  });

  it('alm_acks_total{result} — accepted · rejected 계수', async () => {
    const a0 = await acks('accepted');
    const r0 = await acks('rejected');
    const h = harness();
    await h.events.ack(42);
    await code(h.events.ack(42));
    expect(await acks('accepted')).toBe(a0 + 1);
    expect(await acks('rejected')).toBe(r0 + 1);
  });
});

describe('#1 이벤트 목록 — 범위 기본값 · 키셋 · cache:alarmevents', () => {
  it('열린 · 미확인 필터는 보존 창 시작 · 그 밖은 to − 7일 · 범위 조건은 항상 실린다', () => {
    for (const q of [{ state: 'ACTIVE' }, { acked: 'false' }, { state: 'CLEARED', acked: 'false' }]) {
      expect(buildListSql(listQ(q)).sql).toContain("date_trunc('month', now() - interval '2 years')");
    }
    for (const q of [{}, { state: 'CLEARED' }, { acked: 'true' }]) {
      const { sql } = buildListSql(listQ(q));
      expect(sql).toContain("COALESCE($2::timestamptz, now()) - interval '7 days'");
      expect(sql).toContain('e.occurred_at < COALESCE($2::timestamptz, now())');
    }
    const { sql } = buildListSql(listQ({ acked: 'false' }));
    expect(sql).toContain('e.acked_at IS NULL');
    expect(sql).toContain('ORDER BY e.occurred_at DESC, e.event_id DESC LIMIT $3');
  });

  it('필터 · 커서가 파라미터로 실린다 — 문자열 연결 없음', () => {
    const cursor = encodeCursor('2026-09-26T01:00:00.123456Z', 42);
    const { sql, args } = buildListSql(
      listQ({ state: 'ACTIVE', ruleId: '3', tagId: '7', severity: '2', limit: '10', cursor }),
    );
    expect(sql).toContain('(e.occurred_at, e.event_id) < ($7::timestamptz, $8::bigint)');
    expect(args).toEqual([null, null, 'ACTIVE', 3, 7, 2, '2026-09-26T01:00:00.123456Z', 42, 11]);
  });

  it('커서 왕복 · 깨진 커서 400 query.cursor format', () => {
    expect(decodeCursor(encodeCursor('2026-09-26T01:00:00.000000Z', 5))).toEqual({
      at: '2026-09-26T01:00:00.000000Z',
      id: 5,
    });
    for (const bad of ['xx', Buffer.from('[1,2]').toString('base64url')]) {
      try {
        decodeCursor(bad);
        expect.unreachable();
      } catch (e) {
        expect((e as ApiError).details).toEqual({ fields: [{ path: 'query.cursor', reason: 'format' }] });
      }
    }
  });

  it('미스 → PostgreSQL → 필드 채움(TTL 30) · 다음 요청은 히트(PostgreSQL 안 감) · limit+1로 nextCursor', async () => {
    const rows = [
      { ...EVENT_ROW, event_id: '43' },
      { ...EVENT_ROW, event_id: '42' },
    ];
    const h = harness({ listRows: rows });
    const r1 = await h.events.list(listQ({ limit: '1' }));
    expect(r1.items.map((e) => e.eventId)).toEqual([43]);
    expect(r1.meta).toEqual({ nextCursor: encodeCursor(EVENT_ROW.occurred_cursor, 43), limit: 1 });
    expect(h.cacheSets).toEqual([{ field: eventsCacheField(listQ({ limit: '1' })), ttl: 30 }]);
    const n = h.sqls.length;
    expect(await h.events.list(listQ({ limit: '1' }))).toEqual(r1);
    expect(h.sqls.length).toBe(n);
  });

  it('확인 커밋 뒤 키 하나 DEL → 다음 목록은 PostgreSQL에서 다시 읽는다', async () => {
    const h = harness({ listRows: [{ ...EVENT_ROW }] });
    await h.events.list(listQ({ acked: 'false' }));
    await h.events.ack(42);
    expect(h.cacheStore.size).toBe(0);
    h.world.listRows = [];
    expect((await h.events.list(listQ({ acked: 'false' }))).items).toEqual([]);
  });

  it('필드 정규화 — 같은 순간의 다른 오프셋은 한 필드 · 생략한 from/to는 해석값이 아니라 생략으로', () => {
    const a = eventsCacheField(listQ({ from: '2026-09-26T09:00:00+09:00', to: '2026-09-27T00:00:00Z' }));
    const b = eventsCacheField(listQ({ from: '2026-09-26T00:00:00Z', to: '2026-09-27T09:00:00+09:00' }));
    expect(a).toBe(b);
    expect(eventsCacheField(listQ({}))).toBe(eventsCacheField(listQ({})));
  });

  it('깨진 사본은 미스 · PostgreSQL 불가 503', async () => {
    const h = harness({ listRows: [] });
    h.cacheStore.set(eventsCacheField(listQ()), gzipSync('not json'));
    expect((await h.events.list(listQ())).items).toEqual([]);
    expect(await code(harness({ pgDown: true }).events.list(listQ()))).toBe('common.postgres_unavailable');
  });

  it('요청 검증 — 오프셋 없는 시각 · from ≥ to · severity 4 · limit 201 · 모르는 필드 400', () => {
    for (const q of [
      { from: '2026-09-26T00:00:00' },
      { from: '2026-09-27T00:00:00Z', to: '2026-09-26T00:00:00Z' },
      { severity: '4' },
      { limit: '201' },
      { state: 'ACKED' },
      { page: '2' },
    ]) {
      expect(() => listQ(q)).toThrowError(ApiError);
    }
  });
});

describe('#3 · #4 · #5 규칙 — 트랜잭션 + 감사 → 커밋 → DEL cache:alarmrules → ch:cacheinv', () => {
  it('#4 등록 — 활성 태그 확인 → INSERT → 감사 INSERT → COMMIT → DEL → 발행 순서', async () => {
    const h = harness();
    const body = parseOrThrow(
      AlarmRuleCreateRequest,
      {
        tagId: 7,
        conditionType: 'OUT_OF_RANGE',
        threshold: 90,
        thresholdLow: 10,
        debounceMs: 0,
        severity: 3,
      },
      'body',
    );
    const r = await h.rules.create(body);
    expect(r).toEqual({
      ruleId: 9,
      tagId: 7,
      conditionType: 'OUT_OF_RANGE',
      threshold: 90,
      thresholdLow: 10,
      debounceMs: 0,
      severity: 3,
      enabled: true,
    });
    expect(at(h.log, 'SELECT is_active FROM')).toBeLessThan(at(h.log, 'INSERT INTO alarm_rule'));
    expect(at(h.log, 'INSERT INTO alarm_rule')).toBeLessThan(at(h.log, 'INSERT INTO audit_log'));
    expect(at(h.log, 'INSERT INTO audit_log')).toBeLessThan(at(h.log, 'COMMIT'));
    expect(at(h.log, 'COMMIT')).toBeLessThan(at(h.log, 'DEL cache:alarmrules'));
    expect(at(h.log, 'DEL cache:alarmrules')).toBeLessThan(at(h.log, 'PUBLISH ch:cacheinv'));
    expect(h.published).toEqual([['cache:alarmrules']]);
    const a = h.sqls.find((s) => s.sql.startsWith('INSERT INTO audit_log'));
    expect(a?.sql).toContain('VALUES (NULL,');
    expect(a?.args.slice(0, 4)).toEqual(['INSERT', 'alarm_rule', '9', null]);
  });

  it('#4 비활성 · 없는 태그 400 reference · INSERT · DEL 없음', async () => {
    for (const tagActive of [false, null]) {
      const h = harness({ tagActive });
      const b = parseOrThrow(
        AlarmRuleCreateRequest,
        { tagId: 7, conditionType: 'GT', threshold: 80, debounceMs: 0, severity: 1 },
        'body',
      );
      try {
        await h.rules.create(b);
        expect.unreachable();
      } catch (e) {
        expect((e as ApiError).details).toEqual({ fields: [{ path: 'body.tagId', reason: 'reference' }] });
      }
      expect(h.log.some((l) => l.startsWith('INSERT INTO alarm_rule'))).toBe(false);
      expect(h.log).not.toContain('DEL cache:alarmrules');
    }
  });

  it('#4 검증 — OUT_OF_RANGE 하한 누락 · 그 밖 하한 있음 · 하한 ≥ 상한 · 4값 밖 · 모르는 필드는 트랜잭션 전 400', async () => {
    const h = harness();
    const base = { tagId: 7, threshold: 80, debounceMs: 0, severity: 1 };
    const cases: Record<string, unknown>[] = [
      { ...base, conditionType: 'OUT_OF_RANGE' },
      { ...base, conditionType: 'GT', thresholdLow: 1 },
      { ...base, conditionType: 'OUT_OF_RANGE', thresholdLow: 80 },
    ];
    for (const c of cases) {
      expect(await code(h.rules.create(parseOrThrow(AlarmRuleCreateRequest, c, 'body')))).toBe(
        'common.validation_failed',
      );
    }
    expect(h.log).toEqual([]);
    for (const c of [
      { ...base, conditionType: 'EQ' },
      { ...base, conditionType: 'GT', severity: 4 },
      { ...base, conditionType: 'GT', debounceMs: -1 },
      { ...base, conditionType: 'GT', isActve: true },
    ])
      expect(() => parseOrThrow(AlarmRuleCreateRequest, c, 'body')).toThrowError(ApiError);
  });

  it('#5 불변(ruleId · tagId · conditionType)은 트랜잭션 전 400 immutable', async () => {
    const h = harness();
    const b = parseOrThrow(AlarmRulePatchRequest, { tagId: 8, conditionType: 'LT', threshold: 1 }, 'body');
    try {
      await h.rules.patch(3, b);
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).details).toEqual({
        fields: [
          { path: 'body.tagId', reason: 'immutable' },
          { path: 'body.conditionType', reason: 'immutable' },
        ],
      });
    }
    expect(h.log).toEqual([]);
  });

  it('#5 수정 — UPDATE → 감사 UPDATE(before · after) → COMMIT → DEL → 발행', async () => {
    const h = harness();
    const r = await h.rules.patch(3, parseOrThrow(AlarmRulePatchRequest, { threshold: 85 }, 'body'));
    expect(r.threshold).toBe(85);
    expect(at(h.log, 'UPDATE alarm_rule SET')).toBeLessThan(at(h.log, 'INSERT INTO audit_log'));
    expect(at(h.log, 'COMMIT')).toBeLessThan(at(h.log, 'DEL cache:alarmrules'));
    const a = h.sqls.find((s) => s.sql.startsWith('INSERT INTO audit_log'));
    expect(JSON.parse(a?.args[3] as string).threshold).toBe(80);
    expect(JSON.parse(a?.args[4] as string).threshold).toBe(85);
  });

  it('#5 바뀐 필드 없음 → 감사 · 체인 없음 · 없는 규칙 404 · 결합 규칙 위반 400(롤백 · DEL 없음)', async () => {
    const same = harness();
    await same.rules.patch(3, parseOrThrow(AlarmRulePatchRequest, { threshold: 80, severity: 2 }, 'body'));
    expect(same.log).not.toContain('INSERT INTO audit_log');
    expect(same.log).not.toContain('DEL cache:alarmrules');
    expect(await code(harness({ rule: null }).rules.patch(3, { threshold: 1 }))).toBe('common.not_found');
    const bad = harness();
    expect(await code(bad.rules.patch(3, { thresholdLow: 1 }))).toBe('common.validation_failed');
    expect(bad.log).toContain('ROLLBACK');
    expect(bad.log).not.toContain('DEL cache:alarmrules');
  });

  it('#5 비활성 태그 — 결과가 활성이면 400 reference · 끄는 수정(enabled false)은 허용', async () => {
    expect(await code(harness({ tagActive: false }).rules.patch(3, { threshold: 70 }))).toBe(
      'common.validation_failed',
    );
    const off = harness({ tagActive: false });
    expect((await off.rules.patch(3, { enabled: false })).enabled).toBe(false);
    expect(off.published).toEqual([['cache:alarmrules']]);
  });

  it('감사 실패는 규칙 변경도 롤백 · DEL · 발행 없음(REQ-ALM-03 · 02)', async () => {
    const h = harness({ failOn: /^INSERT INTO audit_log/ });
    expect(await code(h.rules.patch(3, { threshold: 70 }))).toBe('common.postgres_unavailable');
    expect(h.log).toContain('ROLLBACK');
    expect(h.log).not.toContain('DEL cache:alarmrules');
    expect(h.published).toEqual([]);
  });

  it('#3 조회 — 필터 파라미터 · numeric → 수 · PostgreSQL 불가 503', async () => {
    const h = harness();
    const items = await h.rules.list({ tagId: 7, enabled: 'true' });
    expect(items).toEqual([
      {
        ruleId: 3,
        tagId: 7,
        conditionType: 'GT',
        threshold: 80,
        thresholdLow: null,
        debounceMs: 5000,
        severity: 2,
        enabled: true,
      },
    ]);
    const s = h.sqls.at(-1);
    expect(s?.sql).toContain('WHERE tag_id = $1 AND enabled = $2 ORDER BY rule_id');
    expect(s?.args).toEqual([7, true]);
    expect(await code(harness({ pgDown: true }).rules.list({}))).toBe('common.postgres_unavailable');
  });
});

describe('#6 판정 이력 분석 — ClickHouse alarm_eval · 캐시 없음', () => {
  const H = 3_600_000;
  it('해상도 — 1시간 이하 원시 · 7일까지 1분 · 초과 1시간 · maxPoints 넘으면 상향(1h가 끝)', () => {
    expect(chooseEvalInterval(H / 2, 2000)).toBe('raw');
    // 원시 예상 포인트(1,000 ms 주기) 3,600 > 2,000 → 한 단계 상향 — 05_timeseries와 같은 계산
    expect(chooseEvalInterval(H, 2000)).toBe('1m');
    expect(chooseEvalInterval(H, 4000)).toBe('raw');
    expect(chooseEvalInterval(H + 1, 10_000)).toBe('1m');
    expect(chooseEvalInterval(H / 2, 100)).toBe('1m');
    expect(chooseEvalInterval(7 * 24 * H, 2000)).toBe('1h');
    expect(chooseEvalInterval(30 * 24 * H, 10)).toBe('1h');
  });

  function evals(rows: Record<string, unknown>[] | Error, ruleRows: unknown[] = [RULE_ROW]) {
    const calls: { query: string; query_params: Record<string, unknown> }[] = [];
    const ch = {
      client: {
        query: async (a: { query: string; query_params: Record<string, unknown> }) => {
          calls.push(a);
          if (rows instanceof Error) throw rows;
          return { json: async () => rows };
        },
      },
    } as unknown as ClickHouse;
    const pg = { pool: { query: async () => ({ rows: ruleRows }) } } as unknown as Postgres;
    return { svc: new AlarmEvalsService(ch, pg), calls };
  }
  const q = (x: Record<string, string | undefined>) => parseOrThrow(AlarmEvalQuery, x, 'query');

  it('버킷 집계 — points [ts, min, max, breachCount, evalCount] · meta.rule 현재 규칙 · 바인딩 파라미터', async () => {
    const e = evals([
      { rule_id: 3, tag_id: 7, ts_ms: '1000', vmin: 1.5, vmax: 90, breaches: '2', evals: '60' },
      { rule_id: 3, tag_id: 7, ts_ms: '61000', vmin: 2, vmax: 3, breaches: '0', evals: '60' },
    ]);
    const r = await e.svc.query(q({ ruleId: '3', from: '2026-09-26T00:00:00Z', to: '2026-09-27T00:00:00Z' }));
    expect(r.meta).toMatchObject({
      interval: '1m',
      columns: ['ts', 'min', 'max', 'breachCount', 'evalCount'],
      pointCount: 2,
      rule: { ruleId: 3, threshold: 80 },
    });
    expect(r.series).toEqual([
      {
        ruleId: 3,
        tagId: 7,
        points: [
          [1000, 1.5, 90, 2, 60],
          [61000, 2, 3, 0, 60],
        ],
      },
    ]);
    expect(e.calls[0]?.query).toContain('rule_id = {id:UInt32}');
    expect(e.calls[0]?.query).not.toContain('avg(');
    expect(e.calls[0]?.query_params).toMatchObject({ id: 3, bucket: 60_000 });
  });

  it('tagId 요청 · 규칙이 여럿이면 meta.rule null · ClickHouse 불가 503 alarms.eval_store_unavailable', async () => {
    const e = evals([], [RULE_ROW, { ...RULE_ROW, rule_id: 4 }]);
    const r = await e.svc.query(q({ tagId: '7', from: '2026-09-26T00:00:00Z', to: '2026-09-26T00:30:00Z' }));
    expect(r.meta.interval).toBe('raw');
    expect(r.meta.rule).toBeNull();
    expect(e.calls[0]?.query).toContain('tag_id = {id:UInt32}');
    expect(
      await code(
        evals(new Error('down')).svc.query(
          q({ ruleId: '3', from: '2026-09-26T00:00:00Z', to: '2026-09-26T01:00:00Z' }),
        ),
      ),
    ).toBe('alarms.eval_store_unavailable');
  });

  it('요청 검증 — ruleId · tagId 둘 다 · 둘 다 없음 · from/to 누락 · from ≥ to 400', () => {
    const r = { from: '2026-09-26T00:00:00Z', to: '2026-09-26T01:00:00Z' };
    for (const x of [
      { ...r, ruleId: '1', tagId: '2' },
      r,
      { ruleId: '1', from: r.from },
      { ruleId: '1', from: r.to, to: r.from },
    ])
      expect(() => q(x)).toThrowError(ApiError);
  });
});

describe('설정 · 계정 시드', () => {
  it('ALARM_ACK_ACTOR_EMAIL — 기동 시 1회 · 기본 없음(없어도 기동)', () => {
    expect(loadConfig({ WORKER_POOL_SIZE: '1' }).alarmAckActorEmail).toBeNull();
    expect(loadConfig({ WORKER_POOL_SIZE: '1', ALARM_ACK_ACTOR_EMAIL: '' }).alarmAckActorEmail).toBeNull();
    expect(
      loadConfig({ WORKER_POOL_SIZE: '1', ALARM_ACK_ACTOR_EMAIL: 'learner@localhost' }).alarmAckActorEmail,
    ).toBe('learner@localhost');
  });

  it('역할 순서 OPERATOR · ENGINEER · ADMIN · 학습자 email', () => {
    expect(SEED_ROLES).toEqual(['OPERATOR', 'ENGINEER', 'ADMIN']);
    expect(SEED_LEARNER_EMAIL).toBe('learner@localhost');
  });

  it('SEED_USER_PASSWORD 비었거나 자리표시면 거부 · 원문을 에러에 싣지 않는다', () => {
    expect(() => seedUserPassword({})).toThrow(/SEED_USER_PASSWORD/);
    expect(() => seedUserPassword({ SEED_USER_PASSWORD: 'CHANGE_ME' })).toThrow(/자리표시/);
    expect(seedUserPassword({ SEED_USER_PASSWORD: 's3cret-pw' })).toBe('s3cret-pw');
  });

  it('Argon2id 자기 기술 문자열만 통과 · 배선된 argon2idHasher의 해시가 그 검사를 통과한다', async () => {
    expect(
      isArgon2idEncoded(
        '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$qLml5cbqFAO6YxVHhrSBHP0UWdxrIxkNcM8aMX3blzU',
      ),
    ).toBe(true);
    expect(isArgon2idEncoded('$argon2i$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$aGFzaA')).toBe(false);
    expect(isArgon2idEncoded('$2b$10$abcdefghijklmnopqrstuv')).toBe(false);
    expect(isArgon2idEncoded(await argon2idHasher().hash('x'))).toBe(true);
  });
});
