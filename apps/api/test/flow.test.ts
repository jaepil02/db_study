// 흐름 이벤트(EXP-FLOW) 단위 — 정본 docs/07_api/11_websocket.md §흐름 이벤트 — flow
// 발행기: 표지 없음 · 읽기 실패 → 발행 0 · seq · totals(role별) / 배치 요약: 발행 시점(인계 없으면 flusher ⑤ 뒤 · 인계면 판정기 ⑦ 뒤) · stages 6
// 게이트웨이: subscribe_flow 필드 → 4400 · 빈 확인 프레임 · 250 ms 병합 상한(배치 8 · 업무 20) · dropped · totals (source · role) 묶음 · 채널 구독 수명
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import {
  FLOW_CHANNEL,
  FLOW_MARKER_REFRESH_MS,
  FLOW_MARKER_TTL_S,
  FLOW_WINDOW_MS,
  type FlowChannelMessageBody,
  FlowFrame,
} from '@db-study/shared';
import type { Metric } from 'prom-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';
import { type FlowBatchInput, FlowPublisher } from '../src/common/flow/flow-publisher';
import { appRegistry } from '../src/common/metrics/registry';
import type { CacheKeyClient } from '../src/common/redis/cache-key-client';
import type { RedisConnections } from '../src/common/redis/connections';
import type { FanoutPublisher } from '../src/common/redis/fanout-publisher';
import type { DecodedEntry } from '../src/common/workers/tasks';
import { AlarmEvaluator, type AlarmEvaluatorDeps } from '../src/modules/alarm/eval/evaluator';
import { DeterministicBatchToken } from '../src/modules/ingest/batch-token.port';
import { NoopControlSink } from '../src/modules/ingest/control-table-sink.port';
import { Flusher, type FlusherDeps, flowDraft } from '../src/modules/ingest/flusher';
import { createLabFault } from '../src/modules/ingest/lab-fault';
import { IngestLatestValueWriter } from '../src/modules/ingest/latest-value-write.port';
import { type BatchEntry, idMsOf, type Piece } from '../src/modules/ingest/window-buffer';
import type { MasterReadService } from '../src/modules/master/master-read.service';
import { PassthroughThrottle } from '../src/modules/realtime/frame-throttle.port';
import { RealtimeGateway } from '../src/modules/realtime/realtime.gateway';

// ─────────── 발행기 ───────────

function publisher(marker: () => Promise<{ present: boolean; failed: boolean }>) {
  const sent: FlowChannelMessageBody[] = [];
  const cache = { getFlowSubscribed: marker } as unknown as CacheKeyClient;
  const fanout = {
    publishFlow: async (m: FlowChannelMessageBody) => {
      sent.push(m);
      return true;
    },
  } as unknown as FanoutPublisher;
  return { p: new FlowPublisher(cache, fanout, null), sent };
}

function batchInput(over: Partial<FlowBatchInput> = {}): FlowBatchInput {
  return {
    rows: 10,
    stages: {
      streamWaitMs: 1,
      decodeMs: 1,
      chInsertMs: 2,
      controlCopyMs: null,
      latestWriteMs: 1,
      alarmMs: null,
    },
    chRows: 10,
    retries: 0,
    dlqEntries: 0,
    controlCopy: null,
    latestWrites: 4,
    alarm: null,
    stream: null,
    ...over,
  };
}

const bizInput = (result: string, role: 'biz-writer' | 'api-direct' = 'biz-writer', duplicate = false) => ({
  role,
  cmdId: role === 'api-direct' ? null : '3f1c9a2e-8b7d-4c1e-9f0a-2d6b5e4c3a10',
  kind: 'alarm.rule.patch',
  result,
  duplicate,
  stages: { queueWaitMs: 1, txMs: 2, invalidateMs: 1, replyMs: 1 },
  invalidatedKeys: 1,
  cacheinv: true,
});

describe('FlowPublisher — 표지 · seq · totals', () => {
  it('확인 전 · 표지 없음이면 enabled false · 발행 0', async () => {
    const { p, sent } = publisher(async () => ({ present: false, failed: false }));
    expect(p.enabled()).toBe(false);
    p.publishBatch(batchInput());
    await p.check();
    expect(p.enabled()).toBe(false);
    p.publishBatch(batchInput());
    p.publishBiz(bizInput('ok'));
    expect(sent).toHaveLength(0);
  });

  it('표지 읽기 실패(degrade · 예외)면 없음으로 본다 — 켜져 있다가도 끈다', async () => {
    let mode: 'on' | 'failed' | 'throw' = 'on';
    const { p, sent } = publisher(async () => {
      if (mode === 'throw') throw new Error('redis down');
      return mode === 'on' ? { present: true, failed: false } : { present: false, failed: true };
    });
    expect(await p.check()).toBe(true);
    mode = 'failed';
    expect(await p.check()).toBe(false);
    p.publishBatch(batchInput());
    mode = 'on';
    await p.check();
    mode = 'throw';
    expect(await p.check()).toBe(false);
    p.publishBiz(bizInput('ok'));
    expect(sent).toHaveLength(0);
  });

  it('배치 — seq 1부터 · totals 누적(대조군 성공 행 · 판정 · 최신값) · startedAt 고정', async () => {
    const { p, sent } = publisher(async () => ({ present: true, failed: false }));
    await p.check();
    p.publishBatch(
      batchInput({ controlCopy: { rows: 10, ok: true }, alarm: { judgedRows: 10, opened: 1, closed: 0 } }),
    );
    p.publishBatch(batchInput({ controlCopy: { rows: 10, ok: false }, dlqEntries: 2, chRows: 0 }));
    expect(sent.map((m) => m.seq)).toEqual([1, 2]);
    const last = sent[1] as Extract<FlowChannelMessageBody, { event: 'batch' }>;
    expect(last).toMatchObject({ event: 'batch', role: 'ingest', source: p.source, startedAt: p.startedAt });
    expect(last.totals).toEqual({
      batches: 2,
      rows: 20,
      chRows: 10,
      dlqEntries: 2,
      controlCopyRows: 10,
      judgedRows: 10,
      opened: 1,
      closed: 0,
      latestWrites: 8,
    });
  });

  it('업무 — role별 seq · totals(commands = applied + rejected + expired + failed · duplicates는 부분집합)', async () => {
    const { p, sent } = publisher(async () => ({ present: true, failed: false }));
    await p.check();
    p.publishBiz(bizInput('ok'));
    p.publishBiz(bizInput('alarm.rule_not_found', 'biz-writer', true));
    p.publishBiz(bizInput('expired'));
    p.publishBiz(bizInput('common.postgres_unavailable'));
    p.publishBiz(bizInput('ok', 'api-direct'));
    const w = sent.filter((m) => m.role === 'biz-writer');
    expect(w.map((m) => m.seq)).toEqual([1, 2, 3, 4]);
    expect(w[3]?.totals).toEqual({
      commands: 4,
      applied: 1,
      rejected: 1,
      expired: 1,
      failed: 1,
      duplicates: 1,
    });
    const d = sent.find((m) => m.role === 'api-direct');
    expect(d?.seq).toBe(1);
    expect(d?.totals).toEqual({ commands: 1, applied: 1, rejected: 0, expired: 0, failed: 0, duplicates: 0 });
  });
});

// ─────────── 배치 요약 발행 시점 ───────────

function entry(id: string, receivedAt: number, decodedAt: number): BatchEntry {
  const e: DecodedEntry = {
    ok: true,
    d: 1,
    s: 7,
    t0: 1_790_000_000_000,
    tg: [1, 2],
    dt: [0, 0],
    va: [0.5, 1.5],
    q: [9, 9],
    negativeDt: 0,
  };
  return { id, idMs: idMsOf(id), receivedAt, decodedAt, entry: e, payload: Buffer.from(id) };
}

const piece = (): Piece =>
  ({ k: 0, entries: [entry('1000-0', 1012, 1015), entry('1005-0', 1010, 1020)], rows: 4 }) as Piece;

function flusherHarness(opts: { on: boolean; alarm?: boolean; insertFails?: boolean; copyOk?: boolean }) {
  const calls: string[] = [];
  const published: FlowBatchInput[] = [];
  const handed: { flow?: FlowBatchInput | null }[] = [];
  const deps: FlusherDeps = {
    insert: async () => {
      calls.push('insert');
      if (opts.insertFails) throw new Error('ch down');
    },
    tokens: new DeterministicBatchToken(),
    asyncInsert: false,
    control:
      opts.copyOk === undefined
        ? { implName: 'NoopControlSink', copy: async () => true, close: async () => {} }
        : {
            implName: 'PostgresControlSink',
            copy: async () => opts.copyOk as boolean,
            close: async () => {},
          },
    ack: async () => {
      calls.push('ack');
    },
    dlq: async () => {
      calls.push('dlq');
    },
    latest: {
      implName: 'IngestLatestValueWriter',
      write: async () => {
        calls.push('latest');
        return 3;
      },
    },
    alarm: opts.alarm
      ? {
          handoff: async (b) => {
            calls.push('handoff');
            handed.push(b);
          },
          drain: async () => {},
        }
      : null,
    labFault: createLabFault(null),
    sleep: async () => {},
    stopping: () => false,
    log: { warn: () => {}, error: () => {} },
    flow: {
      enabled: () => opts.on,
      publishBatch: (i) => {
        calls.push('flow');
        published.push(i);
      },
    },
    streamStat: () => ({ length: 500, lag: 3 }),
  };
  return { f: new Flusher(deps), calls, published, handed };
}

describe('배치 요약 — 배치당 1건 · 발행 시점', () => {
  it('표지 없음 — 요약을 만들지도 내지도 않는다(인계 초안도 null)', async () => {
    const h = flusherHarness({ on: false, alarm: true });
    expect(await h.f.process(piece())).toBe('inserted');
    expect(h.published).toHaveLength(0);
    expect(h.handed[0]?.flow).toBeNull();
  });

  it('인계 없음 — flusher가 ⑤ 최신값 뒤에 1건 · stages 6 · 대조군 off면 null', async () => {
    const h = flusherHarness({ on: true });
    await h.f.process(piece());
    expect(h.calls).toEqual(['insert', 'ack', 'latest', 'flow']);
    const s = h.published[0] as FlowBatchInput;
    expect(Object.keys(s.stages)).toHaveLength(6);
    // 6a = max(수신 − ID 시각) = max(12, 5) · 6b = max(디코드 − 수신) = max(3, 10)
    expect(s.stages.streamWaitMs).toBe(12);
    expect(s.stages.decodeMs).toBe(10);
    expect(s.stages.controlCopyMs).toBeNull();
    expect(s.stages.alarmMs).toBeNull();
    expect(s).toMatchObject({
      rows: 4,
      chRows: 4,
      retries: 0,
      controlCopy: null,
      latestWrites: 3,
      alarm: null,
    });
    expect(s.stream).toEqual({ length: 500, lag: 3 });
  });

  it('대조군 on — controlCopy {rows · ok}는 copy의 성패 · controlCopyMs는 수', async () => {
    for (const ok of [true, false]) {
      const h = flusherHarness({ on: true, copyOk: ok });
      await h.f.process(piece());
      expect(h.published[0]?.controlCopy).toEqual({ rows: 4, ok });
      expect(h.published[0]?.stages.controlCopyMs).toBeTypeOf('number');
    }
  });

  it('인계 있음 — flusher는 내지 않고 초안을 판정기로 넘긴다', async () => {
    const h = flusherHarness({ on: true, alarm: true });
    await h.f.process(piece());
    expect(h.calls).toEqual(['insert', 'ack', 'latest', 'handoff']);
    expect(h.handed[0]?.flow).toMatchObject({ chRows: 4, latestWrites: 3 });
  });

  it('재시도 소진 → DLQ 배치도 1건(삽입 행 0 · 격리 엔트리 수)', async () => {
    const h = flusherHarness({ on: true, insertFails: true });
    expect(await h.f.process(piece())).toBe('dlq');
    expect(h.published).toHaveLength(1);
    expect(h.published[0]).toMatchObject({ chRows: 0, dlqEntries: 2, retries: 5, latestWrites: null });
  });

  it('수신 시각 없는 엔트리만이면 6a · 6b null', () => {
    const p = piece();
    for (const e of p.entries) delete e.receivedAt;
    expect(flowDraft(p, 4).stages).toMatchObject({ streamWaitMs: null, decodeMs: null });
  });

  it('판정기 — ⑦ 뒤 1건 · alarmMs · judgedRows = 인계 행 · 규칙 없어도 낸다 · 초안 없으면 0건', async () => {
    const published: FlowBatchInput[] = [];
    const deps = {
      rules: { load: async () => ({ rules: [] }) },
      state: { read: async () => new Map(), write: async () => {} },
      confirm: {} as AlarmEvaluatorDeps['confirm'],
      evalSink: { insert: async () => {} },
      fanout: { publishAlarm: async () => {} },
      staleMultiplier: 3,
      sleep: async () => {},
      stopping: () => false,
      log: { warn: () => {}, error: () => {} },
      flow: { publishBatch: (i: FlowBatchInput) => published.push(i) },
    } as AlarmEvaluatorDeps;
    const ev = new AlarmEvaluator(deps);
    const rows = [[1, 1, 1, 1, 9, 0]] as never;
    await ev.handoff({ token: null, rows, flow: batchInput({ rows: 1 }) });
    await ev.handoff({ token: null, rows, flow: null });
    await ev.drain();
    expect(published).toHaveLength(1);
    expect(published[0]?.alarm).toEqual({ judgedRows: 1, opened: 0, closed: 0 });
    expect(published[0]?.stages.alarmMs).toBeTypeOf('number');
  });
});

// ─────────── 게이트웨이 ───────────

async function framesSent(channel: string): Promise<number> {
  const m = appRegistry.getSingleMetric('ws_frames_sent_total') as Metric;
  return (await m.get()).values.find((v) => v.labels.channel === channel)?.value ?? 0;
}

function gateway() {
  const subs: string[] = [];
  const sub = Object.assign(new EventEmitter(), {
    status: 'ready',
    subscribe: async (ch: string) => {
      subs.push(`+${ch}`);
      return 1;
    },
    unsubscribe: async (ch: string) => {
      subs.push(`-${ch}`);
      return 1;
    },
  });
  const redis = { subscriberConnection: () => sub } as unknown as RedisConnections;
  const master = { deviceExists: async () => true } as unknown as MasterReadService;
  const markers: [string, number][] = [];
  const cache = {
    setFlowSubscribed: async (owner: string, ttl: number) => {
      markers.push([owner, ttl]);
      return true;
    },
  } as unknown as CacheKeyClient;
  const gw = new RealtimeGateway(redis, master, new PassthroughThrottle(), cache);
  const open = () => {
    const ws = Object.assign(new EventEmitter(), {
      OPEN: 1,
      readyState: 1,
      bufferedAmount: 0,
      sent: [] as Record<string, unknown>[],
      closed: null as number | null,
      send(m: string) {
        this.sent.push(JSON.parse(m));
      },
      close(code: number) {
        this.closed = code;
        this.readyState = 3;
      },
      terminate() {},
    });
    gw.handleConnection(
      ws as unknown as WebSocket,
      { headers: { origin: 'http://localhost:3001' }, url: '/ws/realtime' } as IncomingMessage,
    );
    const say = async (m: unknown) => {
      ws.emit('message', Buffer.from(JSON.stringify(m)));
      await vi.advanceTimersByTimeAsync(0);
    };
    const flows = () => ws.sent.filter((x) => x.type === 'flow');
    return { ws, say, flows };
  };
  const emit = (m: FlowChannelMessageBody) => sub.emit('message', FLOW_CHANNEL, JSON.stringify(m));
  return { gw, subs, markers, open, emit };
}

function batchMsg(seq: number, source = 'worker@a'): FlowChannelMessageBody {
  return {
    event: 'batch',
    source,
    role: 'ingest',
    seq,
    at: 1_790_000_000_000 + seq,
    ...batchInput(),
    startedAt: 1_789_000_000_000,
    totals: {
      batches: seq,
      rows: seq * 10,
      chRows: seq * 10,
      dlqEntries: 0,
      controlCopyRows: 0,
      judgedRows: 0,
      opened: 0,
      closed: 0,
      latestWrites: 0,
    },
  };
}

function bizMsg(seq: number, role: 'biz-writer' | 'api-direct' = 'biz-writer'): FlowChannelMessageBody {
  return {
    event: 'biz',
    source: 'worker@a',
    seq,
    at: 1_790_000_000_000 + seq,
    ...bizInput('ok', role),
    startedAt: 1_789_000_000_000,
    totals: { commands: seq, applied: seq, rejected: 0, expired: 0, failed: 0, duplicates: 0 },
  };
}

describe('게이트웨이 — flow 구독 · 병합', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('subscribe_flow · unsubscribe_flow에 필드가 오면 4400', async () => {
    const g = gateway();
    const a = g.open();
    await a.say({ type: 'subscribe_flow', devices: [1] });
    expect(a.ws.closed).toBe(4400);
    const b = g.open();
    await b.say({ type: 'unsubscribe_flow', x: 1 });
    expect(b.ws.closed).toBe(4400);
    g.gw.onModuleDestroy();
  });

  it('구독 확인 — 즉시 빈 flow 프레임 1회 · 첫 구독자에서만 SUBSCRIBE · 표지 TTL 15초 · 5초마다 갱신', async () => {
    const g = gateway();
    const before = await framesSent('flow');
    const a = g.open();
    const b = g.open();
    await a.say({ type: 'subscribe_flow' });
    await b.say({ type: 'subscribe_flow' });
    for (const c of [a, b]) {
      expect(c.flows()).toHaveLength(1);
      const f = c.flows()[0];
      expect(FlowFrame.safeParse(f).success).toBe(true);
      expect(f).toMatchObject({ batches: [], biz: [], totals: [], dropped: { batches: 0, biz: 0 } });
    }
    expect(await framesSent('flow')).toBe(before + 2);
    expect(g.subs.filter((s) => s === `+${FLOW_CHANNEL}`)).toHaveLength(1);
    expect(g.markers).toHaveLength(1);
    expect(g.markers[0]?.[1]).toBe(FLOW_MARKER_TTL_S);
    await vi.advanceTimersByTimeAsync(FLOW_MARKER_REFRESH_MS * 2);
    expect(g.markers).toHaveLength(3);
    // 요약 없는 창은 보내지 않는다
    expect(a.flows()).toHaveLength(1);
    g.gw.onModuleDestroy();
  });

  it('250 ms 병합 — 창 안 배치 최신 8 · 업무 최신 20 · 넘친 수 dropped · 배치 seq 오름차순 · 창당 1 프레임', async () => {
    const g = gateway();
    const a = g.open();
    const idle = g.open(); // 흐름 구독 안 한 연결은 받지 않는다
    await a.say({ type: 'subscribe_flow' });
    for (const s of [3, 1, 2, 4, 5, 6, 7, 8, 9, 10]) g.emit(batchMsg(s));
    for (let s = 1; s <= 23; s++) g.emit(bizMsg(s));
    await vi.advanceTimersByTimeAsync(FLOW_WINDOW_MS);
    const frames = a.flows().slice(1);
    expect(frames).toHaveLength(1);
    const f = frames[0] as {
      batches: { seq: number }[];
      biz: { seq: number }[];
      dropped: { batches: number; biz: number };
    };
    expect(FlowFrame.safeParse(f).success).toBe(true);
    expect(f.batches.map((x) => x.seq)).toEqual([2, 4, 5, 6, 7, 8, 9, 10]);
    expect(f.biz).toHaveLength(20);
    expect(f.biz[0]?.seq).toBe(4);
    expect(f.dropped).toEqual({ batches: 2, biz: 3 });
    expect(idle.ws.sent.filter((x) => x.type === 'flow')).toHaveLength(0);
    // 다음 창은 새로 센다
    g.emit(batchMsg(11));
    await vi.advanceTimersByTimeAsync(FLOW_WINDOW_MS);
    expect(a.flows().at(-1)).toMatchObject({ dropped: { batches: 0, biz: 0 } });
    g.gw.onModuleDestroy();
  });

  it('totals — (source · role)마다 창 안 마지막 값 하나 · 한 source의 ingest · biz-writer · api-direct는 따로', async () => {
    const g = gateway();
    const a = g.open();
    await a.say({ type: 'subscribe_flow' });
    g.emit(batchMsg(1));
    g.emit(batchMsg(2));
    g.emit(batchMsg(7, 'worker@b'));
    g.emit(bizMsg(1));
    g.emit(bizMsg(2));
    g.emit(bizMsg(1, 'api-direct'));
    await vi.advanceTimersByTimeAsync(FLOW_WINDOW_MS);
    const f = a.flows().at(-1) as {
      totals: { source: string; role: string; batches?: number; commands?: number }[];
    };
    expect(f.totals).toHaveLength(4);
    const key = (t: { source: string; role: string }) => `${t.source}/${t.role}`;
    const by = new Map(f.totals.map((t) => [key(t), t]));
    expect(by.get('worker@a/ingest')?.batches).toBe(2);
    expect(by.get('worker@b/ingest')?.batches).toBe(7);
    expect(by.get('worker@a/biz-writer')?.commands).toBe(2);
    expect(by.get('worker@a/api-direct')?.commands).toBe(1);
    g.gw.onModuleDestroy();
  });

  it('형식이 틀린 ch:flow 메시지는 버린다 · 마지막 구독자 해지 · 종료면 UNSUBSCRIBE · 표지 갱신 중단', async () => {
    const g = gateway();
    const a = g.open();
    const b = g.open();
    await a.say({ type: 'subscribe_flow' });
    await b.say({ type: 'subscribe_flow' });
    g.emit({ ...batchMsg(1), rows: -1 } as FlowChannelMessageBody);
    await vi.advanceTimersByTimeAsync(FLOW_WINDOW_MS);
    expect(a.flows()).toHaveLength(1);
    await a.say({ type: 'unsubscribe_flow' });
    expect(g.subs).not.toContain(`-${FLOW_CHANNEL}`);
    b.ws.emit('close');
    await vi.advanceTimersByTimeAsync(0);
    expect(g.subs).toContain(`-${FLOW_CHANNEL}`);
    const n = g.markers.length;
    await vi.advanceTimersByTimeAsync(FLOW_MARKER_REFRESH_MS * 3);
    expect(g.markers).toHaveLength(n);
    g.gw.onModuleDestroy();
  });
});

describe('포트 반환값 — 흐름 요약 재료', () => {
  it('NoopControlSink.copy는 true · IngestLatestValueWriter.write는 받아들인 필드 수 합', async () => {
    expect(await new NoopControlSink().copy()).toBe(true);
    const durable = {
      writeLatestIfNewer: async (d: number, tuples: unknown[]) => (d === 1 ? tuples : tuples.slice(1)),
    };
    const fanout = { publishRt: async () => {} };
    const w = new IngestLatestValueWriter(durable as never, fanout as never, () => {});
    const e1 = entry('1000-0', 1, 1);
    const e2 = { ...entry('1001-0', 1, 1), entry: { ...entry('1001-0', 1, 1).entry, d: 2 } };
    // 설비 1: 태그 2 모두 · 설비 2: 태그 2 중 1
    expect(await w.write([e1, e2])).toBe(3);
  });
});
