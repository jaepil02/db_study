// S3 적재 단위 — 창 정렬 배치 · 결정적 토큰 · R · P 분할 · 다중 컨슈머 닫힘 · 회수 커서(06_pipeline/03)
// 재시도 백오프 · DLQ 필드(06_pipeline/12) · SW-08 off 삽입 설정 · 대조군 COPY 순서(04_routing) · 결함 주입 기본 비활성
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DLQ_FIELDS, STREAM_DLQ } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import type { RedisConnections } from '../src/common/redis/connections';
import { DurableKeyClient } from '../src/common/redis/durable-key-client';
import type { DecodedEntry } from '../src/common/workers/tasks';
import { loadConfig } from '../src/config/app-config';
import {
  batchToken,
  DeterministicBatchToken,
  insertSettings,
  NoBatchToken,
} from '../src/modules/ingest/batch-token.port';
import {
  type ControlTableSinkPort,
  copyLine,
  PostgresControlSink,
} from '../src/modules/ingest/control-table-sink.port';
import { Flusher, type FlusherDeps, isMvError, RETRY_BACKOFF_MS } from '../src/modules/ingest/flusher';
import { ingestMetrics } from '../src/modules/ingest/ingest.metrics';
import {
  consumerNames,
  FLUSHER_ACTIVE_SLOTS,
  FLUSHER_HOLD_SLOTS,
  heldBatches,
} from '../src/modules/ingest/ingest.service';
import { createLabFault, LAB_FAULT_EXIT_CODE, labFaultWarning } from '../src/modules/ingest/lab-fault';
import {
  type BatchEntry,
  entryBytes,
  idMsOf,
  type Piece,
  splitPieces,
  WindowBuffer,
} from '../src/modules/ingest/window-buffer';

const BASE_ENV = { WORKER_POOL_SIZE: '1' };
/** 결함 주입 표지 — 테스트마다 없는 경로(임시 디렉터리) */
const markerIn = () => join(mkdtempSync(join(tmpdir(), 'lab-fault-')), 'lab-fault-fired');

/** 태그 tags개짜리 엔트리 — 행 수 = tags */
function entry(id: string, tags = 2, d = 1): BatchEntry {
  const e: DecodedEntry = {
    ok: true,
    d,
    s: 7,
    t0: 1_790_000_000_000,
    tg: Array.from({ length: tags }, (_, i) => i + 1),
    dt: Array.from({ length: tags }, () => 0),
    va: Array.from({ length: tags }, (_, i) => i + 0.5),
    q: Array.from({ length: tags }, () => 9),
    negativeDt: 0,
  };
  return { id, idMs: idMsOf(id), decodedAt: 0, entry: e, payload: Buffer.from(id) };
}

const tokens = new DeterministicBatchToken();
function tokenOf(p: Piece): string {
  const ids = p.entries.map((e) => e.id);
  return tokens.tokenFor(ids[0] as string, ids[ids.length - 1] as string, p.rows);
}
function shape(pieces: Piece[]) {
  return pieces.map((p) => ({ k: p.k, ids: p.entries.map((e) => e.id), rows: p.rows, token: tokenOf(p) }));
}

describe('결정적 토큰 — 같은 엔트리 집합 → 같은 창 · 같은 분할 · 같은 토큰', () => {
  const ids = ['5010-0', '5020-0', '5020-1', '5300-0', '5700-0', '5999-3', '6001-0', '6500-0', '7000-0'];

  /**
   * 재전달 모사 — Redis는 그룹 안에서 ID 오름차순으로 배달하고 읽기 한 번은 연속 구간을 가져간다.
   * 연속 구간(chunk)을 컨슈머에 돌려 배분하고, 한 바퀴 안의 인계 순서는 perm으로 섞는다(컨슈머 안 순서는 유지).
   */
  function run(
    chunk: number,
    consumers: number,
    perm: (round: number[]) => number[],
  ): ReturnType<typeof shape> {
    const names = Array.from({ length: consumers }, (_, i) => `c${i + 1}`);
    const b = new WindowBuffer({
      windowMs: 1000,
      limits: { maxRows: 5, maxBytes: Number.POSITIVE_INFINITY },
      consumers: names,
    });
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunk) chunks.push(ids.slice(i, i + chunk));
    const out: Piece[] = [];
    for (let r = 0; r < chunks.length; r += consumers) {
      const round = Array.from({ length: Math.min(consumers, chunks.length - r) }, (_, i) => i);
      for (const i of perm(round)) {
        for (const id of chunks[r + i] as string[]) b.add(entry(id), names[i]);
        out.push(...b.takePieces());
      }
    }
    for (const n of names) b.setIdle(n, true);
    out.push(...b.takePieces(), ...b.drainPieces());
    return shape(out);
  }

  it('컨슈머 수 · 읽기 구간 · 인계 순서가 달라도 조각 · 토큰이 같다(재시작 뒤 재전달 모사)', () => {
    const a = run(ids.length, 1, (r) => r);
    expect(run(2, 3, (r) => [...r].reverse())).toEqual(a);
    expect(run(3, 2, (r) => [...r].reverse())).toEqual(a);
    expect(run(1, 3, (r) => [r[1], r[2], r[0]].filter((x) => x !== undefined) as number[])).toEqual(a);
    // 창 5: 6엔트리 × 2행 = 12행 → R 5행이면 2엔트리(4행)씩 3조각 · 창 6 · 7
    expect(a.map((p) => [p.k, p.rows])).toEqual([
      [5, 4],
      [5, 4],
      [5, 4],
      [6, 4],
      [7, 2],
    ]);
  });

  it('토큰 = sha1(첫 ID|끝 ID|행 수) · 재료가 하나라도 다르면 다르다', () => {
    const t = batchToken('5010-0', '5020-0', 4);
    expect(t).toMatch(/^[0-9a-f]{40}$/);
    expect(batchToken('5010-0', '5020-0', 4)).toBe(t);
    expect(batchToken('5010-0', '5020-0', 5)).not.toBe(t);
    expect(batchToken('5010-0', '5020-1', 4)).not.toBe(t);
  });

  it('창이 닫히기 전 확정 접두로 먼저 내보낸 조각 = 창이 닫힌 뒤 통째로 자른 조각', () => {
    const early = new WindowBuffer({ limits: { maxRows: 4, maxBytes: 1e9 } });
    const out: Piece[] = [];
    for (const id of ['1000-0', '1100-0', '1200-0', '1300-0', '1400-0']) {
      early.add(entry(id));
      out.push(...early.takePieces());
    }
    // 1400-0이 들어와 경계가 1400 → 1000~1300은 확정. 첫 조각은 1200이 넘치게 해 경계가 섰고,
    // 둘째 조각(1200 · 1300)은 다음 확정 엔트리가 아직 없어 창이 닫히기 전에는 나가지 않는다
    expect(out.map((p) => p.entries.map((e) => e.id))).toEqual([['1000-0', '1100-0']]);
    out.push(...early.drainPieces());
    const whole = splitPieces(
      ['1000-0', '1100-0', '1200-0', '1300-0', '1400-0'].map((id) => entry(id)),
      { maxRows: 4, maxBytes: 1e9 },
      true,
    ).pieces;
    expect(out.map((p) => p.entries.map((e) => e.id))).toEqual(whole.map((p) => p.map((e) => e.id)));
  });
});

describe('R · P 분할', () => {
  it('행 수 R에 닿는 자리에서 자르고 엔트리는 쪼개지 않는다 · 상한보다 큰 엔트리는 혼자 한 조각', () => {
    const list = [entry('1-0', 3), entry('2-0', 3), entry('3-0', 10), entry('4-0', 1)];
    const { pieces } = splitPieces(list, { maxRows: 6, maxBytes: 1e9 }, true);
    expect(pieces.map((p) => p.map((e) => e.id))).toEqual([['1-0', '2-0'], ['3-0'], ['4-0']]);
  });

  it('페이로드 P(JSONCompactEachRow 바이트)에 닿는 자리에서 자른다', () => {
    const e = entry('1-0', 1);
    // [1790000000000,1,1,0.5,9,7]\n
    expect(entryBytes(e)).toBe('[1790000000000,1,1,0.5,9,7]\n'.length);
    const list = [entry('1-0', 1), entry('2-0', 1), entry('3-0', 1)];
    const one = entryBytes(list[0] as BatchEntry);
    const { pieces } = splitPieces(list, { maxRows: 1000, maxBytes: one * 2 }, true);
    expect(pieces.map((p) => p.length)).toEqual([2, 1]);
  });

  it('final이 아니면 마지막 조각은 확정하지 않는다 — 다음 엔트리가 넘치게 할 때만 경계가 선다', () => {
    const r = splitPieces([entry('1-0', 2), entry('2-0', 2)], { maxRows: 4, maxBytes: 1e9 }, false);
    expect(r.pieces).toEqual([]);
    expect(r.rest.map((e) => e.id)).toEqual(['1-0', '2-0']);
  });
});

describe('다중 컨슈머 — 인계 워터마크 최솟값 닫힘', () => {
  it('ⓐ 한 컨슈머라도 창 끝에 못 미치면 닫지 않는다', () => {
    const b = new WindowBuffer({ consumers: ['c1', 'c2'] });
    b.add(entry('5100-0'), 'c1');
    b.add(entry('6100-0'), 'c1'); // c1 워터마크 6100 ≥ 창 5 끝
    b.add(entry('5200-0'), 'c2'); // c2 워터마크 5200
    expect(b.takePieces()).toEqual([]);
    b.add(entry('6050-0'), 'c2'); // 최솟값 6050 ≥ 6000
    expect(b.takePieces().map((p) => [p.k, p.entries.map((e) => e.id)])).toEqual([[5, ['5100-0', '5200-0']]]);
  });

  it('대기 중인 컨슈머는 따라잡은 것으로 본다(인계 전체 최댓값)', () => {
    const b = new WindowBuffer({ consumers: ['c1', 'c2'] });
    b.add(entry('5100-0'), 'c1');
    b.add(entry('6100-0'), 'c1');
    expect(b.takePieces()).toEqual([]); // c2는 아무것도 인계하지 않았다
    b.setIdle('c2', true);
    expect(b.takePieces().map((p) => p.k)).toEqual([5]);
  });

  it('ⓑ 모든 컨슈머가 꼬리까지 읽은 읽기 시작이 창 끝 + 유예를 넘어야 닫힌다', () => {
    const b = new WindowBuffer({ consumers: ['c1', 'c2'], graceMs: 100 });
    b.add(entry('7200-0'), 'c1');
    b.markDrained('c1', 8100);
    expect(b.takePieces()).toEqual([]);
    b.markDrained('c2', 8099);
    expect(b.takePieces()).toEqual([]);
    b.markDrained('c2', 8100);
    expect(b.takePieces().map((p) => p.k)).toEqual([7]);
  });

  it('컨슈머 이름은 ingest-1..N 고정', () => {
    expect(consumerNames(3)).toEqual(['ingest-1', 'ingest-2', 'ingest-3']);
  });
});

describe('회수 커서 — 회수 창은 커서가 창 끝을 지나야 닫힌다', () => {
  function closedBuffer() {
    const b = new WindowBuffer();
    b.add(entry('20000-0'));
    b.add(entry('21000-0'));
    b.takePieces(); // 창 20 닫힘 → 창 5 · 6은 이미 닫힌 과거
    return b;
  }

  it('커서가 창 끝 전이면 닫지 않고 · 지나면 닫는다 · 스캔 끝(null)이면 전부', () => {
    const b = closedBuffer();
    b.setReclaimCursor(0);
    b.addRecovered(entry('5100-0'));
    b.addRecovered(entry('5900-0'));
    b.addRecovered(entry('6100-0'));
    b.setReclaimCursor(5950);
    expect(b.takePieces().filter((p) => p.recovered)).toEqual([]);
    b.setReclaimCursor(6000);
    const first = b.takePieces().filter((p) => p.recovered);
    expect(first.map((p) => [p.k, p.entries.map((e) => e.id)])).toEqual([[5, ['5100-0', '5900-0']]]);
    b.setReclaimCursor(null);
    expect(b.takePieces().map((p) => [p.k, p.recovered])).toEqual([[6, true]]);
  });

  it('종료로 스캔이 끊기면 회수 창을 닫지 않고 버린다(PEL에 남긴다)', () => {
    const b = closedBuffer();
    b.setReclaimCursor(0);
    b.addRecovered(entry('5100-0', 3));
    const before = b.assemblingRows;
    expect(b.discardRecovered()).toEqual(['5100-0']);
    expect(b.assemblingRows).toBe(before - 3);
    expect(b.drainPieces().filter((p) => p.recovered)).toEqual([]);
  });

  it('아직 열린 창의 회수분은 일반 창으로 간다', () => {
    const b = new WindowBuffer();
    b.add(entry('9100-0'));
    b.addRecovered(entry('9050-0'));
    expect(b.drainPieces().map((p) => p.entries.map((e) => e.id))).toEqual([['9050-0', '9100-0']]);
  });
});

describe('flusher 보유 상한', () => {
  it('문서 표 4칸 · S3 정지 조건은 창 버퍼 + 삽입 중 2칸', () => {
    const total = Object.values(FLUSHER_HOLD_SLOTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
    expect(FLUSHER_ACTIVE_SLOTS).toBe(2);
    expect(heldBatches(1, 0, 50_000, 1)).toBe(2); // 닫혀 대기 1 + 삽입 중 1 → 멈춤
    expect(heldBatches(0, 49_999, 50_000, 1)).toBe(1); // 조립 중 R 미만은 0칸
    expect(heldBatches(0, 100_000, 50_000, 0)).toBe(2); // 조립 중 2R → 멈춤
  });
});

// ---- flusher 순서 계약 ----

interface Harness {
  calls: string[];
  sleeps: number[];
  dlqItems: unknown[];
  deps: FlusherDeps;
}

function harness(opts: {
  insertFails?: (attempt: number) => Error | null;
  control?: ControlTableSinkPort;
  stopping?: boolean;
  tokenPort?: FlusherDeps['tokens'];
}): Harness {
  const calls: string[] = [];
  const sleeps: number[] = [];
  const dlqItems: unknown[] = [];
  let attempt = 0;
  const deps: FlusherDeps = {
    insert: async (_rows, settings) => {
      const err = opts.insertFails?.(attempt++) ?? null;
      calls.push(`insert:${JSON.stringify(settings)}`);
      if (err) throw err;
    },
    tokens: opts.tokenPort ?? new DeterministicBatchToken(),
    asyncInsert: false,
    control: opts.control ?? {
      implName: 'PostgresControlSink',
      copy: async () => {
        calls.push('copy');
      },
      close: async () => {},
    },
    ack: async (ids) => {
      calls.push(`ack:${ids.length}`);
    },
    dlq: async (items) => {
      calls.push(`dlq:${items.length}`);
      dlqItems.push(...items);
    },
    latest: {
      implName: 'IngestLatestValueWriter',
      write: async () => {
        calls.push('latest');
      },
    },
    labFault: createLabFault(null),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    stopping: () => opts.stopping ?? false,
    log: { warn: () => {}, error: () => {} },
  };
  return { calls, sleeps, dlqItems, deps };
}

function piece(ids: string[]): Piece {
  const entries = ids.map((id) => entry(id));
  return { k: 1, seq: 0, recovered: false, entries, rows: entries.length * 2, bytes: 0 };
}

const kinds = (calls: string[]) => calls.map((c) => c.split(':')[0]);

describe('재시도 · 백오프 · DLQ', () => {
  it('백오프 1 · 2 · 4 · 8 · 16초 · 재시도 5회(합 31초 < idle 60초) · 같은 토큰', async () => {
    expect([...RETRY_BACKOFF_MS]).toEqual([1000, 2000, 4000, 8000, 16000]);
    expect(RETRY_BACKOFF_MS.reduce((a, b) => a + b, 0)).toBeLessThan(60_000);
    const h = harness({ insertFails: (n) => (n < 3 ? new Error('connect ECONNREFUSED') : null) });
    const before = (await ingestMetrics.insertRetries.get()).values[0]?.value ?? 0;
    expect(await new Flusher(h.deps).process(piece(['1000-0', '1001-0']))).toBe('inserted');
    expect(h.sleeps).toEqual([1000, 2000, 4000]);
    const inserts = h.calls.filter((c) => c.startsWith('insert'));
    expect(new Set(inserts).size).toBe(1); // 네 번 모두 같은 설정(같은 토큰)
    expect(inserts[0]).toContain('insert_deduplication_token');
    expect((await ingestMetrics.insertRetries.get()).values[0]?.value).toBe(before + 3);
  });

  it('소진하면 원 엔트리마다 DLQ(원 배치 토큰) → XACK · 대조군 · 최신값 없음', async () => {
    const h = harness({ insertFails: () => new Error('Code: 241. MEMORY_LIMIT_EXCEEDED') });
    const p = piece(['2000-0', '2000-1', '2001-0']);
    expect(await new Flusher(h.deps).process(p)).toBe('dlq');
    expect(h.sleeps).toEqual([...RETRY_BACKOFF_MS]);
    expect(kinds(h.calls)).toEqual([
      'insert',
      'insert',
      'insert',
      'insert',
      'insert',
      'insert',
      'dlq',
      'ack',
    ]);
    const token = batchToken('2000-0', '2001-0', 6);
    expect(h.dlqItems).toEqual(
      p.entries.map((e) => ({
        payload: e.payload,
        originId: e.id,
        reason: 'retry_exhausted',
        batchToken: token,
      })),
    );
  });

  it('DLQ 쓰기가 실패하면 XACK하지 않는다(PEL에 남긴다)', async () => {
    const h = harness({ insertFails: () => new Error('x') });
    h.deps.dlq = async () => {
      throw new Error('redis down');
    };
    expect(await new Flusher(h.deps).process(piece(['3000-0']))).toBe('abandoned');
    expect(h.calls.some((c) => c.startsWith('ack'))).toBe(false);
  });

  it('종료 중 실패는 재시도하지 않고 PEL에 남긴다', async () => {
    const h = harness({ insertFails: () => new Error('x'), stopping: true });
    expect(await new Flusher(h.deps).process(piece(['3100-0']))).toBe('abandoned');
    expect(kinds(h.calls)).toEqual(['insert']);
  });

  it('MV 실패 뒤 재시도 성공 — ing_mv_errors_total{error · retry_ok} · 롤업 의심 계수', async () => {
    expect(isMvError(new Error('Code: 241 ... while pushing to view plc.mv_tag_1m (uuid)'))).toBe(true);
    expect(isMvError(new Error('Timeout'))).toBe(false);
    const get = async (result: string) =>
      (await ingestMetrics.mvErrors.get()).values.find((v) => v.labels.result === result)?.value ?? 0;
    const [e0, ok0] = [await get('error'), await get('retry_ok')];
    const s0 = (await ingestMetrics.rollupSuspect.get()).values[0]?.value ?? 0;
    const h = harness({
      insertFails: (n) => (n === 0 ? new Error('Too many parts while pushing to view plc.mv_tag_1m') : null),
    });
    expect(await new Flusher(h.deps).process(piece(['3200-0']))).toBe('inserted');
    expect(await get('error')).toBe(e0 + 1);
    expect(await get('retry_ok')).toBe(ok0 + 1);
    expect((await ingestMetrics.rollupSuspect.get()).values[0]?.value).toBe(s0 + 1);
  });
});

describe('DLQ 엔트리 필드 모양(06_pipeline/12 §DLQ 엔트리)', () => {
  function fakeClient() {
    const xadds: unknown[][] = [];
    const pipe = {
      xadd: (...a: unknown[]) => {
        xadds.push(a);
        return pipe;
      },
      exec: async () => xadds.map(() => [null, '1-0']),
    };
    const conns = { command: { defineCommand() {}, pipeline: () => pipe } } as unknown as RedisConnections;
    return { client: new DurableKeyClient(conns), xadds };
  }

  it('재시도 소진 — p 원 본문 · oid 원 ID · reason · token 원 토큰 · MAXLEN ~', async () => {
    const { client, xadds } = fakeClient();
    const token = batchToken('1-0', '1-0', 2);
    await client.appendDlq(
      STREAM_DLQ,
      [{ payload: Buffer.from([1, 2]), originId: '1-0', reason: 'retry_exhausted', batchToken: token }],
      10_000,
    );
    expect(xadds).toEqual([
      [
        'stream:plc:dlq',
        'MAXLEN',
        '~',
        10_000,
        '*',
        DLQ_FIELDS.payload,
        Buffer.from([1, 2]),
        DLQ_FIELDS.originId,
        '1-0',
        DLQ_FIELDS.reason,
        'retry_exhausted',
        DLQ_FIELDS.batchToken,
        token,
      ],
    ]);
  });

  it('해독 불가 — 토큰 필드 없음 · 계약 밖 값은 쓰지 않고 던진다', async () => {
    const { client, xadds } = fakeClient();
    await client.appendDlq(
      STREAM_DLQ,
      [{ payload: Buffer.from([9]), originId: '2-0', reason: 'undecodable', batchToken: null }],
      10_000,
    );
    expect(xadds[0]).toHaveLength(11);
    expect(xadds[0]).not.toContain(DLQ_FIELDS.batchToken);
    await expect(
      client.appendDlq(
        STREAM_DLQ,
        [{ payload: Buffer.from([9]), originId: 'bad', reason: 'undecodable', batchToken: null }],
        10_000,
      ),
    ).rejects.toThrow();
  });
});

describe('SW-08 삽입 설정', () => {
  it('on — insert_deduplication_token', () => {
    const t = new DeterministicBatchToken().tokenFor('1-0', '2-0', 3);
    expect(insertSettings(new DeterministicBatchToken(), t, false)).toEqual({
      insert_deduplication_token: t,
    });
  });

  it('off — 토큰 없음 + deduplicate_insert disable(26.8은 토큰 없는 같은 내용도 중복 제거 · insert_deduplicate는 이 설정이 대체)', () => {
    const off = new NoBatchToken();
    expect(off.tokenFor()).toBeNull();
    expect(insertSettings(off, null, false)).toEqual({ deduplicate_insert: 'disable' });
  });

  it('배치 안 C — async_insert 1 · wait_for_async_insert 1이 토큰 설정에 더해진다', () => {
    expect(insertSettings(new NoBatchToken(), null, true)).toEqual({
      deduplicate_insert: 'disable',
      async_insert: 1,
      wait_for_async_insert: 1,
    });
  });

  it('off로 소진하면 DLQ 토큰 필드가 비어 있다', async () => {
    const h = harness({ insertFails: () => new Error('x'), tokenPort: new NoBatchToken() });
    await new Flusher(h.deps).process(piece(['4000-0']));
    expect(h.dlqItems).toEqual([expect.objectContaining({ batchToken: null })]);
  });
});

describe('대조군 COPY 순서(04_routing §대조군 동시 적재 기전)', () => {
  it('성공 — 삽입 → COPY → XACK → 최신값', async () => {
    const h = harness({});
    expect(await new Flusher(h.deps).process(piece(['5000-0']))).toBe('inserted');
    expect(kinds(h.calls)).toEqual(['insert', 'copy', 'ack', 'latest']);
  });

  it('삽입 재시도 중에는 COPY하지 않는다 — 성공 뒤 1회', async () => {
    const h = harness({ insertFails: (n) => (n < 2 ? new Error('x') : null) });
    await new Flusher(h.deps).process(piece(['5100-0']));
    expect(kinds(h.calls)).toEqual(['insert', 'insert', 'insert', 'copy', 'ack', 'latest']);
  });

  it('삽입이 끝내 실패하면 COPY하지 않는다', async () => {
    const h = harness({ insertFails: () => new Error('x') });
    await new Flusher(h.deps).process(piece(['5200-0']));
    expect(h.calls).not.toContain('copy');
  });

  it('COPY가 실패해도 XACK한다 — 실패는 계수 + 구간 로그(ts 최솟값 · 최댓값 · 행 수 · 토큰)', async () => {
    const logs: string[] = [];
    // 닫힌 포트로 즉시 연결 거부 — 전용 커넥션 실패 = 그 배치 실패
    const sink = new PostgresControlSink(
      'postgres://u:p@127.0.0.1:1/plc',
      { error: (s) => logs.push(s), warn: () => {} },
      2000,
    );
    const before = (await ingestMetrics.controlCopyFailures.get()).values[0]?.value ?? 0;
    const h = harness({ control: sink });
    expect(await new Flusher(h.deps).process(piece(['5300-0', '5300-1']))).toBe('inserted');
    expect(kinds(h.calls)).toEqual(['insert', 'ack', 'latest']);
    expect((await ingestMetrics.controlCopyFailures.get()).values[0]?.value).toBe(before + 1);
    const rec = JSON.parse(logs[0] as string);
    expect(rec).toMatchObject({
      event: 'control_copy_failed',
      ts_min: 1_790_000_000_000,
      ts_max: 1_790_000_000_000,
      rows: 4,
      token: batchToken('5300-0', '5300-1', 4),
    });
    await sink.close();
  });

  it('COPY 한 줄 — ts는 UTC ISO(ms) · 탭 구분 · 열 순서는 tag_raw 행과 같다', () => {
    expect(copyLine([1_790_000_000_123, 1, 2, 3.5, 9, 7])).toBe(
      '2026-09-21T14:13:20.123Z\t1\t2\t3.5\t9\t7\n',
    );
  });
});

describe('결함 주입(INGEST_LAB_FAULT)', () => {
  it('비활성이 기본 — 환경변수가 없으면 null · afterInsert는 아무것도 하지 않는다', () => {
    const cfg = loadConfig(BASE_ENV);
    expect(cfg.ingestLabFault).toBeNull();
    const f = createLabFault(cfg.ingestLabFault, () => {
      throw new Error('호출되면 안 된다');
    });
    expect(f.enabled).toBe(false);
    for (let i = 0; i < 10; i++) f.afterInsert();
  });

  it('crash-after-insert:n — n번째 삽입 성공 직후 137로 끝낸다', () => {
    const cfg = loadConfig({ ...BASE_ENV, INGEST_LAB_FAULT: 'crash-after-insert:2' });
    const exits: number[] = [];
    const marker = markerIn();
    const f = createLabFault(
      cfg.ingestLabFault,
      (code) => {
        exits.push(code);
        throw new Error('exit');
      },
      marker,
    );
    expect(f.enabled).toBe(true);
    f.afterInsert();
    expect(exits).toEqual([]);
    expect(existsSync(marker)).toBe(false);
    expect(() => f.afterInsert()).toThrow('exit');
    expect(exits).toEqual([LAB_FAULT_EXIT_CODE]);
    expect(existsSync(marker)).toBe(true); // 발동 직전에 표지를 남긴다
  });

  it('표지가 있으면 발동하지 않는다 — 재기동 루프 방지 · 경고 lab_fault_already_fired', () => {
    const marker = markerIn();
    writeFileSync(marker, 'fired\n');
    const f = createLabFault(
      { kind: 'crash-after-insert', afterBatches: 1 },
      () => {
        throw new Error('호출되면 안 된다');
      },
      marker,
    );
    expect(f.enabled).toBe(false);
    expect(f.state).toBe('already_fired');
    for (let i = 0; i < 5; i++) f.afterInsert();
    expect(labFaultWarning(f.state)).toBe('lab_fault_already_fired');
  });

  it('flusher — 삽입 성공 직후 · COPY · XACK 전에 끝난다', async () => {
    const h = harness({});
    h.deps.labFault = createLabFault(
      { kind: 'crash-after-insert', afterBatches: 1 },
      () => {
        throw new Error('exit');
      },
      markerIn(),
    );
    await expect(new Flusher(h.deps).process(piece(['6000-0']))).rejects.toThrow('exit');
    expect(kinds(h.calls)).toEqual(['insert']);
  });
});

describe('검수 회귀 — PEL 재읽기 · 회수 창의 확정 접두', () => {
  it('D1 — PEL을 다시 읽는 컨슈머를 대기로 두지 않으면 옛 창이 남은 PEL보다 먼저 닫히지 않는다', () => {
    const b = new WindowBuffer({
      windowMs: 1000,
      consumers: ['c1', 'c2'],
      limits: { maxRows: 50, maxBytes: 1e9 },
    });
    b.add(entry('100-0', 10), 'c1');
    b.add(entry('200-0', 10), 'c1');
    b.add(entry('5100-0', 10), 'c2'); // 다른 컨슈머는 새 엔트리
    // c1은 PEL 모드라 대기 표시를 하지 않는다(서비스 규칙) — 하한은 c1 워터마크 200
    expect(b.takePieces()).toEqual([]);
    b.add(entry('300-0', 10), 'c1'); // 남은 PEL 페이지
    expect(b.lateEntries).toBe(0);
  });

  it('D2 — 회수 창은 커서 미만에서 완성된 조각을 먼저 내보낸다(2R 이상 쌓여도 보유 셈이 풀린다)', () => {
    const b = new WindowBuffer({ windowMs: 1000, consumers: ['c1'], limits: { maxRows: 50, maxBytes: 1e9 } });
    b.add(entry('10000-0', 10), 'c1');
    b.markDrained('c1', 20_000);
    b.takePieces(); // 창 10까지 닫힘
    b.setReclaimCursor(0);
    for (let i = 0; i < 12; i++) b.addRecovered(entry(`${5000 + i * 10}-0`, 10)); // 창 5 회수분 120행
    b.setReclaimCursor(5100); // 커서가 창 5 안 — 5000~5090은 확정
    const early = b.takePieces();
    expect(early.map((p) => p.rows)).toEqual([50]); // 확정 100행 중 완성된 조각 하나(나머지 50은 다음 엔트리를 기다린다)
    expect(Math.floor(b.assemblingRows / 50)).toBe(1);
    b.setReclaimCursor(null);
    const rest = b.takePieces();
    // 창이 닫힌 뒤 통째로 자른 것과 같은 경계 — 50 · 50 · 20
    const whole = splitPieces(
      Array.from({ length: 12 }, (_, i) => entry(`${5000 + i * 10}-0`, 10)),
      { maxRows: 50, maxBytes: 1e9 },
      true,
    ).pieces.map((p) => p.map((e) => e.id));
    expect([...early, ...rest].map((p) => p.entries.map((e) => e.id))).toEqual(whole);
  });
});
