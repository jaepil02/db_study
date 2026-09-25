// S4 마스터 쓰기 — 판정 분기(07_api/04) · 트랜잭션 · 감사 · 체인 순서(06_pipeline/07). 가짜 풀 · 가짜 체인으로 SQL 순서를 본다.
import { TagCreateRequest, tagShapeIssues } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/common/http/api-error';
import type { Postgres } from '../src/common/postgres/postgres.module';
import { FanoutPublisher } from '../src/common/redis/fanout-publisher';
import {
  type ChainTargets,
  type InvalidationChain,
  InvalidationChain as InvalidationChainImpl,
  mstMetrics,
} from '../src/modules/master/invalidation-chain';
import { MasterWriteService } from '../src/modules/master/master-write.service';

const TAG_ROW = {
  tag_id: 7,
  device_id: 1,
  tag_code: 'D1-T7',
  tag_name: '온도',
  function_code: 3,
  address: 10,
  data_type: 'FLOAT32',
  word_order: 'ABCD',
  scale: 1,
  offset_value: 0,
  unit: '℃',
  deadband: 0,
  scan_rate_ms: 1000,
  range_min: null,
  range_max: null,
  is_active: true,
};

/** 가짜 풀 — 질의 로그 · 태그 행 상태를 들고 있다 */
function harness(opts: { tag?: Record<string, unknown> | null; failOn?: RegExp } = {}) {
  const log: string[] = [];
  const chains: ChainTargets[] = [];
  let tag: Record<string, unknown> | null = opts.tag === undefined ? { ...TAG_ROW } : opts.tag;
  let nextId = 100;
  const client = {
    query: async (sql: string, args: unknown[] = []) => {
      const s = sql.replace(/\s+/g, ' ').trim();
      log.push(s.split(' ').slice(0, 3).join(' '));
      if (opts.failOn?.test(s))
        throw Object.assign(new Error('x'), { code: '23505', constraint: 'tag_master_tag_code_key' });
      if (/FROM tag_master WHERE tag_id/.test(s)) {
        const id = Number(args[0]);
        if (tag && id === tag.tag_id) return { rowCount: 1, rows: [tag] };
        if (id >= 100) return { rowCount: 1, rows: [{ ...TAG_ROW, tag_id: id }] };
        return { rowCount: 0, rows: [] };
      }
      if (/^INSERT INTO tag_master /.test(s)) return { rowCount: 1, rows: [{ tag_id: nextId++ }] };
      if (/^UPDATE tag_master SET is_active = false/.test(s) && tag) tag = { ...tag, is_active: false };
      if (/^UPDATE tag_master SET/.test(s) && tag && !/is_active/.test(s))
        tag = { ...tag, tag_name: args[1] };
      if (/^INSERT INTO tag_master_history/.test(s)) return { rowCount: 1, rows: [{ history_id: 9 }] };
      return { rowCount: 1, rows: [] };
    },
    release: () => {},
  };
  const pg = { pool: { connect: async () => client } } as unknown as Postgres;
  const chain = {
    afterCommit: async (t: ChainTargets) => {
      log.push('CHAIN');
      chains.push(t);
    },
  } as unknown as InvalidationChain;
  return { svc: new MasterWriteService(pg, chain), log, chains };
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof ApiError ? e.code : String(e);
  }
};

describe('태그 PATCH 세 갈래 — 수정 가능 · 스케일 409 · 불변 400', () => {
  it('스케일이 현재와 다르면 409 · 같으면 변경 없음', async () => {
    expect(await code(harness().svc.patchTag(7, { scale: 2 }))).toBe('master.scale_change_forbidden');
    const h = harness();
    await h.svc.patchTag(7, { scale: 1, offsetValue: 0 });
    expect(h.log).not.toContain('INSERT INTO audit_log');
    expect(h.chains).toEqual([]);
  });

  it('불변 필드(tagId · deviceId · isActive)는 트랜잭션 전에 400 immutable', async () => {
    const h = harness();
    expect(await code(h.svc.patchTag(7, { isActive: false }))).toBe('common.validation_failed');
    expect(h.log).toEqual([]);
  });

  it('바뀐 필드가 있으면 UPDATE → 감사 → COMMIT → 체인(② ③ ④) 순서', async () => {
    const h = harness();
    await h.svc.patchTag(7, { tagName: '온도-1' });
    const i = (x: string) => h.log.findIndex((l) => l.startsWith(x));
    expect(i('UPDATE tag_master SET')).toBeLessThan(i('INSERT INTO audit_log'));
    expect(i('INSERT INTO audit_log')).toBeLessThan(i('COMMIT'));
    expect(i('COMMIT')).toBeLessThan(i('CHAIN'));
    expect(h.chains).toEqual([{ tagIds: [7], reloadDictionary: true }]);
  });

  it('없는 태그 404 · 롤백 · 체인 없음', async () => {
    const h = harness({ tag: null });
    expect(await code(h.svc.patchTag(7, { tagName: 'x' }))).toBe('common.not_found');
    expect(h.log).toContain('ROLLBACK');
    expect(h.chains).toEqual([]);
  });
});

describe('논리 삭제 · 새 태그 발급', () => {
  it('이미 비활성이면 변경 · 감사 · 체인 없이 200', async () => {
    const h = harness({ tag: { ...TAG_ROW, is_active: false } });
    const r = await h.svc.deactivateTag(7);
    expect(r.isActive).toBe(false);
    expect(h.log).not.toContain('INSERT INTO audit_log');
    expect(h.chains).toEqual([]);
  });

  it('비활성 원천에서 발급하면 409 master.reissue_source_inactive', async () => {
    const h = harness({ tag: { ...TAG_ROW, is_active: false } });
    expect(await code(h.svc.reissueTag(7, { newTagCode: 'N', scale: 2 }))).toBe(
      'master.reissue_source_inactive',
    );
  });

  it('변환식이 현재와 같으면 400 · 다르면 한 트랜잭션(발급 · 비활성 · 이력 · 감사 2) + 두 tag_id 체인', async () => {
    expect(await code(harness().svc.reissueTag(7, { newTagCode: 'N' }))).toBe('common.validation_failed');
    const h = harness();
    const r = await h.svc.reissueTag(7, { newTagCode: 'N', scale: 1.8, offsetValue: 32, unit: '℉' });
    expect(r).toMatchObject({ oldTagId: 7, historyId: 9, newTag: { tagId: 100 } });
    expect(h.log.filter((l) => l === 'INSERT INTO audit_log')).toHaveLength(2);
    expect(h.chains).toEqual([{ tagIds: [100, 7], reloadDictionary: true }]);
  });

  it('tag_code 중복은 409 common.duplicate_key(field tagCode) · 롤백', async () => {
    const h = harness({ failOn: /^INSERT INTO tag_master \(/ });
    const b = TagCreateRequest.parse({
      deviceId: 1,
      tagCode: 'D1-T7',
      tagName: 'x',
      functionCode: 3,
      address: 1,
      dataType: 'UINT16',
      scanRateMs: 1000,
    });
    expect(await code(h.svc.createTag(b))).toBe('common.duplicate_key');
    expect(h.log).toContain('ROLLBACK');
  });
});

describe('태그 결합 규칙(저장 CHECK와 같다)', () => {
  it('1워드 · BOOL은 wordOrder null · 2워드 이상은 필수 · BOOL ↔ FC 1 · 2 · min < max', () => {
    expect(
      tagShapeIssues({
        functionCode: 3,
        dataType: 'UINT16',
        wordOrder: null,
        rangeMin: null,
        rangeMax: null,
      }),
    ).toEqual([]);
    expect(
      tagShapeIssues({
        functionCode: 3,
        dataType: 'FLOAT32',
        wordOrder: null,
        rangeMin: null,
        rangeMax: null,
      }),
    ).toHaveLength(1);
    expect(
      tagShapeIssues({ functionCode: 3, dataType: 'BOOL', wordOrder: null, rangeMin: null, rangeMax: null }),
    ).toHaveLength(1);
    expect(
      tagShapeIssues({ functionCode: 3, dataType: 'UINT16', wordOrder: null, rangeMin: 5, rangeMax: 5 }),
    ).toHaveLength(1);
  });
});

describe('체인 실패 degrade — 요청을 실패시키지 않고 계수만(REQ-MST-10 · 검수 L6)', () => {
  it('② DEL 실패 · ③ 발행 실패여도 afterCommit은 성공 · mst_cache_delete_failures_total 증가 · ④ 실패는 result failed', async () => {
    const count = async (
      m: { get(): Promise<{ values: { value: number; labels: Record<string, unknown> }[] }> },
      k: string,
      v: string,
    ) => (await m.get()).values.filter((x) => x.labels[k] === v).reduce((a, x) => a + x.value, 0);
    const d0 = await count(mstMetrics.cacheDeleteFailures, 'prefix', 'cache:tagmeta');
    const r0 = await count(mstMetrics.dictReloads, 'result', 'failed');
    const cache = { delTagMeta: async () => false, delDevList: async () => false };
    // 실제 발행기 · 발행이 던지는 Redis — publishCacheInv가 삼키고 false
    const fanout = new FanoutPublisher({
      command: {
        publish: async () => {
          throw new Error('down');
        },
      },
    } as never);
    const ch = {
      client: {
        command: async () => {
          throw new Error('ch down');
        },
      },
    };
    const chain = new InvalidationChainImpl(cache as never, fanout, ch as never);
    await expect(chain.afterCommit({ tagIds: [7], reloadDictionary: true })).resolves.toBeUndefined();
    await new Promise((r) => setTimeout(r, 20));
    expect(await count(mstMetrics.cacheDeleteFailures, 'prefix', 'cache:tagmeta')).toBe(d0 + 1);
    expect(await count(mstMetrics.dictReloads, 'result', 'failed')).toBe(r0 + 1);
  });
});
