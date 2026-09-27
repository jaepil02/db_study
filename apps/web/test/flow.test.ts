// EXP-FLOW 화면 상태 변환 — 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW 표시 계약 · docs/07_api/11_websocket.md §흐름 이벤트
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  animScale,
  applyFlowFrame,
  arriveAt,
  BATCH_STAGES,
  batchPlan,
  bizOutcome,
  bizPlan,
  emptyFlowState,
  FLOW_RING,
  flowMetricRates,
  flowRates,
  flowSubStatus,
  flowSwitchFlags,
  formatScale,
  isAckFrame,
  noSummary,
  perRowBytes,
  planProgress,
  summarizeFlow,
  trackRate,
} from '../lib/flow';
import { parsePrometheusText } from '../lib/metrics-parser';
import type {
  FlowBatchSummaryBody,
  FlowBizSummaryBody,
  FlowFrameBody,
  FlowTotalsEntryBody,
} from '../lib/shared';
import { FlowFrame } from '../lib/shared';

function batch(seq: number, over: Partial<FlowBatchSummaryBody> = {}): FlowBatchSummaryBody {
  return {
    event: 'batch',
    source: 'worker-1',
    role: 'ingest',
    seq,
    at: 1_000_000 + seq,
    rows: 10_000,
    stages: {
      streamWaitMs: 12,
      decodeMs: 4,
      chInsertMs: 64,
      controlCopyMs: null,
      latestWriteMs: 3,
      alarmMs: 6,
    },
    chRows: 10_000,
    retries: 0,
    dlqEntries: 0,
    controlCopy: null,
    latestWrites: 2_400,
    alarm: { judgedRows: 320, opened: 1, closed: 0 },
    stream: { length: 81_234, lag: 3 },
    ...over,
  };
}

function biz(seq: number, over: Partial<FlowBizSummaryBody> = {}): FlowBizSummaryBody {
  return {
    event: 'biz',
    source: 'worker-1',
    role: 'biz-writer',
    seq,
    at: 2_000_000 + seq,
    cmdId: '3f1c9a2e-8b7d-4c1e-9f0a-2d6b5e4c3a10',
    kind: 'alarm.rule.patch',
    result: 'ok',
    duplicate: false,
    stages: { queueWaitMs: 2, txMs: 4.2, invalidateMs: 1.1, replyMs: 0.6 },
    invalidatedKeys: 1,
    cacheinv: true,
    ...over,
  };
}

function ingestTotals(startedAt: number, rows: number, batches: number): FlowTotalsEntryBody {
  return {
    source: 'worker-1',
    role: 'ingest',
    startedAt,
    batches,
    rows,
    chRows: rows,
    dlqEntries: 0,
    controlCopyRows: 0,
    judgedRows: 0,
    opened: 0,
    closed: 0,
    latestWrites: 0,
  };
}

function frame(windowEnd: number, over: Partial<FlowFrameBody> = {}): FlowFrameBody {
  return {
    type: 'flow',
    windowEnd,
    batches: [],
    biz: [],
    dropped: { batches: 0, biz: 0 },
    totals: [],
    ...over,
  };
}

describe('프레임 → 화면 상태', () => {
  it('문서 예시 프레임이 공유 스키마를 통과하고 배치 · 업무가 상태에 든다', () => {
    const f = FlowFrame.parse(
      frame(1_758_675_600_250, {
        batches: [batch(5120)],
        biz: [biz(42)],
        totals: [ingestTotals(1_758_670_000_000, 51_200_000, 5120)],
      }),
    );
    const r = applyFlowFrame(emptyFlowState(), f, 1_758_675_600_300);
    expect(r.state.timeline).toHaveLength(1);
    expect(r.state.biz).toHaveLength(1);
    expect(r.added.batches.map((b) => b.seq)).toEqual([5120]);
    expect(r.state.clockOffset).toBe(50);
    expect(r.state.lastBatchAt).toBe(batch(5120).at);
    expect(r.state.latestBatch?.seq).toBe(5120);
  });

  it('빈 프레임은 구독 확인 — seq 추적을 비워 재연결 틈을 병합 생략으로 적지 않는다', () => {
    let s = applyFlowFrame(emptyFlowState(), frame(1000, { batches: [batch(10)] }), 1000).state;
    expect(isAckFrame(frame(2000))).toBe(true);
    s = applyFlowFrame(s, frame(2000), 2000).state;
    expect(s.lastSeq).toEqual({});
    expect(s.lastFrameAt).toBe(2000);
    s = applyFlowFrame(s, frame(3000, { batches: [batch(50)] }), 3000).state;
    expect(s.timeline.filter((e) => e.kind === 'gap')).toHaveLength(0);
    expect(s.skipped).toBe(0);
  });

  it('병합 생략 — seq가 건너뛰면 점을 만들지 않고 틈 표지(받은 배치만 점)', () => {
    let s = applyFlowFrame(emptyFlowState(), frame(1000, { batches: [batch(1), batch(2)] }), 1000).state;
    const r = applyFlowFrame(s, frame(1250, { batches: [batch(6)], dropped: { batches: 3, biz: 0 } }), 1250);
    s = r.state;
    expect(r.added.batches.map((b) => b.seq)).toEqual([6]);
    expect(s.timeline.map((e) => (e.kind === 'batch' ? `#${e.batch.seq}` : `gap${e.skipped}`))).toEqual([
      '#1',
      '#2',
      'gap3',
      '#6',
    ]);
    expect(s.skipped).toBe(3);
    expect(s.dropped).toEqual({ batches: 3, biz: 0 });
  });

  it('배치는 seq 오름차순으로 넣고 같은 seq 중복은 버린다', () => {
    const s = applyFlowFrame(
      emptyFlowState(),
      frame(1000, { batches: [batch(3), batch(2), batch(3)] }),
      1000,
    ).state;
    expect(s.timeline.map((e) => (e.kind === 'batch' ? e.batch.seq : -1))).toEqual([2, 3]);
  });

  it('seq가 줄면 재기동 — 틈을 두지 않는다', () => {
    let s = applyFlowFrame(emptyFlowState(), frame(1000, { batches: [batch(500)] }), 1000).state;
    s = applyFlowFrame(s, frame(2000, { batches: [batch(1)] }), 2000).state;
    expect(s.timeline.some((e) => e.kind === 'gap')).toBe(false);
    expect(s.lastSeq['worker-1']).toBe(1);
  });

  it('source가 다르면 seq를 따로 센다', () => {
    const s = applyFlowFrame(
      emptyFlowState(),
      frame(1000, { batches: [batch(1), batch(7, { source: 'worker-2' })] }),
      1000,
    ).state;
    const s2 = applyFlowFrame(
      s,
      frame(1250, { batches: [batch(2), batch(8, { source: 'worker-2' })] }),
      1250,
    ).state;
    expect(s2.skipped).toBe(0);
  });

  it('링 20 — 타임라인은 배치 20개 · 업무는 새것이 앞 20건', () => {
    let s = emptyFlowState();
    for (let i = 1; i <= 30; i++) {
      s = applyFlowFrame(s, frame(i * 1000, { batches: [batch(i)], biz: [biz(i)] }), i * 1000).state;
    }
    expect(s.timeline.filter((e) => e.kind === 'batch')).toHaveLength(FLOW_RING);
    expect(s.timeline[0]?.kind === 'batch' && s.timeline[0].batch.seq).toBe(11);
    expect(s.biz).toHaveLength(FLOW_RING);
    expect(s.biz[0]?.seq).toBe(30);
  });

  it('틈이 링 앞에서 밀려나면 남기지 않는다', () => {
    let s = applyFlowFrame(emptyFlowState(), frame(1000, { batches: [batch(1)] }), 1000).state;
    s = applyFlowFrame(s, frame(2000, { batches: [batch(5)] }), 2000).state;
    for (let i = 6; i <= 25; i++)
      s = applyFlowFrame(s, frame(i * 1000, { batches: [batch(i)] }), i * 1000).state;
    expect(s.timeline[0]?.kind).toBe('batch');
    expect(s.timeline.filter((e) => e.kind === 'batch')).toHaveLength(FLOW_RING);
  });
});

describe('totals — 간선 굵기 · 초당 값 · 재기동', () => {
  it('최근 10초 차 ÷ 초 · 샘플 하나면 null', () => {
    let s = applyFlowFrame(emptyFlowState(), frame(0, { totals: [ingestTotals(1, 0, 0)] }), 0).state;
    const track = () => s.totals['worker-1|ingest'];
    expect(trackRate(track() as never, 'rows', 0)).toBeNull();
    s = applyFlowFrame(s, frame(5_000, { totals: [ingestTotals(1, 50_000, 5)] }), 5_000).state;
    s = applyFlowFrame(s, frame(10_000, { totals: [ingestTotals(1, 100_000, 10)] }), 10_000).state;
    // 지금 10초 — 창 [0, 10000] · 기준 샘플 0
    expect(trackRate(track() as never, 'rows', 10_000)).toBeCloseTo(10_000);
    // 지금 15초 — 창 [5000, 15000] · 기준 5000 샘플 · 뒤 5초는 요약 없음(0)
    expect(trackRate(track() as never, 'rows', 15_000)).toBeCloseTo(5_000);
    expect(flowRates(s.totals, 10_000).batches).toBeCloseTo(1);
  });

  it('startedAt이 바뀌면 그 source의 이력을 버린다 — 한 창 건너뛰고 음의 처리량을 그리지 않는다', () => {
    let s = applyFlowFrame(emptyFlowState(), frame(0, { totals: [ingestTotals(1, 0, 0)] }), 0).state;
    s = applyFlowFrame(s, frame(5_000, { totals: [ingestTotals(1, 900_000, 90)] }), 5_000).state;
    s = applyFlowFrame(s, frame(6_000, { totals: [ingestTotals(2, 1_000, 1)] }), 6_000).state;
    const t = s.totals['worker-1|ingest'];
    expect(t?.restarts).toBe(1);
    expect(t?.samples).toHaveLength(1);
    expect(flowRates(s.totals, 6_000).rows).toBeNull();
    s = applyFlowFrame(s, frame(7_000, { totals: [ingestTotals(2, 11_000, 2)] }), 7_000).state;
    expect(flowRates(s.totals, 7_000).rows).toBeCloseTo(10_000);
  });

  it('startedAt이 같아도 누적이 줄면 재기동으로 본다', () => {
    let s = applyFlowFrame(emptyFlowState(), frame(0, { totals: [ingestTotals(1, 500, 5)] }), 0).state;
    s = applyFlowFrame(s, frame(1_000, { totals: [ingestTotals(1, 100, 1)] }), 1_000).state;
    expect(s.totals['worker-1|ingest']?.restarts).toBe(1);
    expect(flowRates(s.totals, 1_000).rows).toBeNull();
  });

  it('업무 명령 초당 값은 role로 가른다 — biz-writer · api-direct', () => {
    const bt = (role: 'biz-writer' | 'api-direct', commands: number): FlowTotalsEntryBody => ({
      source: 'app-1',
      role,
      startedAt: 1,
      commands,
      applied: commands,
      rejected: 0,
      expired: 0,
      failed: 0,
      duplicates: 0,
    });
    let s = applyFlowFrame(
      emptyFlowState(),
      frame(0, { totals: [bt('biz-writer', 0), bt('api-direct', 0)] }),
      0,
    ).state;
    s = applyFlowFrame(
      s,
      frame(10_000, { totals: [bt('biz-writer', 20), bt('api-direct', 5)] }),
      10_000,
    ).state;
    const r = flowRates(s.totals, 10_000);
    expect(r.commandsWriter).toBeCloseTo(2);
    expect(r.commandsDirect).toBeCloseTo(0.5);
    expect(r.commands).toBeCloseTo(2.5);
  });
});

describe('점 계획 — 단계 순서 · 배율', () => {
  it('배치 점은 ⑧ 순서 그대로 · null 단계는 건너뛴다 · XACK는 대조군 뒤 최신값 앞', () => {
    const p = batchPlan(batch(1));
    expect(p.legs.map((l) => l.to)).toEqual(['stream', 'worker', 'worker', 'ch', 'xack', 'latest', 'alarm']);
    const withCopy = batchPlan(
      batch(1, {
        stages: {
          streamWaitMs: 1,
          decodeMs: 1,
          chInsertMs: 1,
          controlCopyMs: 1,
          latestWriteMs: null,
          alarmMs: null,
        },
      }),
    );
    expect(withCopy.legs.map((l) => l.to)).toEqual(['stream', 'worker', 'worker', 'ch', 'pgCopy', 'xack']);
  });

  it('배율 — 1.5초보다 짧으면 한 배율로 늘리고 비율은 유지', () => {
    const p = batchPlan(batch(1)); // 합 89 ms
    expect(p.scale).toBeCloseTo(1500 / 89);
    expect(p.totalMs).toBeCloseTo(1500);
    const ch = p.legs.find((l) => l.stage === 'chInsertMs');
    const dec = p.legs.find((l) => l.stage === 'decodeMs');
    expect((ch?.ms ?? 0) / (dec?.ms ?? 1)).toBeCloseTo(64 / 4);
    expect(animScale(3000)).toBe(1);
    expect(formatScale(1)).toBe('실시간 속도');
    expect(formatScale(16.85)).toBe('×17 느리게');
    expect(formatScale(2.5)).toBe('×2.5 느리게');
  });

  it('타임라인 단계 6 순서', () => {
    expect(BATCH_STAGES.map((s) => s.key)).toEqual([
      'streamWaitMs',
      'decodeMs',
      'chInsertMs',
      'controlCopyMs',
      'latestWriteMs',
      'alarmMs',
    ]);
  });

  it('진행 — 경과에 따라 다리를 옮긴다', () => {
    const p = batchPlan(batch(1));
    expect(planProgress(p, 0).to).toBe('stream');
    expect(planProgress(p, p.totalMs + 1).done).toBe(true);
    expect(arriveAt(p, 'ch')).not.toBeNull();
    expect(arriveAt(p, 'pgCopy')).toBeNull();
  });

  it('업무 점 ok — 대기 → 트랜잭션 → 무효화 → 결과 → 응답', () => {
    const p = bizPlan(biz(1));
    expect(p.legs.map((l) => l.to)).toEqual(['bizStream', 'bizWorker', 'pgTx', 'cache', 'result', 'api']);
    expect(p.mark).toBeNull();
  });

  it('결과 분류 — ok · expired · failed(common.postgres_unavailable) · 그 밖 오류 코드는 rejected', () => {
    expect(bizOutcome('ok')).toBe('ok');
    expect(bizOutcome('expired')).toBe('expired');
    expect(bizOutcome('common.postgres_unavailable')).toBe('failed');
    expect(bizOutcome('master.duplicate_code')).toBe('rejected');
  });

  it('rejected ✕ · failed ⚠는 트랜잭션 노드 · duplicate ↺ · expired ⌛는 트랜잭션을 건너뛴다', () => {
    const rej = bizPlan(
      biz(1, {
        result: 'alarm.rule_not_found',
        stages: { queueWaitMs: 1, txMs: 2, invalidateMs: null, replyMs: 1 },
      }),
    );
    expect(rej.mark).toEqual({ symbol: '✕', at: 'pgTx', code: 'alarm.rule_not_found' });
    const failed = bizPlan(
      biz(2, {
        result: 'common.postgres_unavailable',
        stages: { queueWaitMs: 1, txMs: null, invalidateMs: null, replyMs: 1 },
      }),
    );
    expect(failed.mark?.symbol).toBe('⚠');
    expect(failed.legs.map((l) => l.to)).toContain('pgTx');
    const dup = bizPlan(
      biz(3, { duplicate: true, stages: { queueWaitMs: 1, txMs: null, invalidateMs: null, replyMs: 1 } }),
    );
    expect(dup.mark?.symbol).toBe('↺');
    expect(dup.legs.map((l) => l.to)).not.toContain('pgTx');
    const exp = bizPlan(
      biz(4, { result: 'expired', stages: { queueWaitMs: 9, txMs: null, invalidateMs: null, replyMs: 1 } }),
    );
    expect(exp.mark?.symbol).toBe('⌛');
    expect(exp.legs.map((l) => l.to)).not.toContain('pgTx');
  });

  it('role api-direct는 스트림 · 워커 · 결과 노드를 건너뛴다 — source가 같아도 role로 가른다', () => {
    const p = bizPlan(
      biz(1, {
        role: 'api-direct',
        cmdId: null,
        stages: { queueWaitMs: null, txMs: 3, invalidateMs: 1, replyMs: null },
      }),
    );
    expect(p.legs.map((l) => l.to)).toEqual(['pgTx', 'cache', 'api']);
    // cmdId가 있어도 role biz-writer면 명령 경로
    const w = bizPlan(biz(2, { role: 'biz-writer' }));
    expect(w.legs[0]?.to).toBe('bizStream');
  });
});

describe('스위치 표지 · 구독 상태', () => {
  const sw = (id: string, value: string | number) => ({
    [id]: { name: id, value, impl: 'X', warning: null },
  });

  it('요약 필드가 health보다 이긴다', () => {
    const f = flowSwitchFlags(
      batch(1, { controlCopy: { rows: 1, ok: true }, latestWrites: null, stream: null }),
      null,
      null,
    );
    expect(f.controlCopyOff).toBe(false);
    expect(f.collectorLatest).toBe(true);
    expect(f.streamOff).toBe(true);
  });

  it('요약이 없으면 health — SW-09 기본 off · SW-12 direct', () => {
    expect(flowSwitchFlags(null, null, {}).controlCopyOff).toBe(true);
    expect(flowSwitchFlags(null, null, sw('SW-09', 'on')).controlCopyOff).toBe(false);
    expect(flowSwitchFlags(null, null, sw('SW-12', 'direct')).bizDirect).toBe(true);
    expect(flowSwitchFlags(null, biz(1), sw('SW-12', 'direct')).bizDirect).toBe(false);
    expect(flowSwitchFlags(null, biz(1, { role: 'api-direct' }), null).bizDirect).toBe(true);
  });

  it('구독 표지 3상태는 셸 WS를 따른다 · 요약 없음 10초', () => {
    expect(flowSubStatus('reconnecting', 'subscribed')).toBe('disconnected');
    expect(flowSubStatus('open', 'requesting')).toBe('requesting');
    expect(flowSubStatus('open', 'subscribed')).toBe('subscribed');
    expect(noSummary({ lastFrameAt: 0 }, 'subscribed', 9_999)).toBe(false);
    expect(noSummary({ lastFrameAt: 0 }, 'subscribed', 10_000)).toBe(true);
    expect(noSummary({ lastFrameAt: 0 }, 'disconnected', 20_000)).toBe(false);
  });
});

describe('메트릭 흐름 보기', () => {
  const text = [
    'ch_parts_bytes_on_disk{table="tag_raw"} 1000',
    'ch_parts_uncompressed_bytes{table="tag_raw"} 8000',
    'ch_parts_rows{table="tag_raw"} 100',
    'ch_new_parts_total{table="tag_raw"} 10',
    'pg_relation_size_bytes{table="alarm_event",kind="heap"} 800',
    'pg_relation_size_bytes{table="alarm_event",kind="index"} 200',
    'pg_table_live_tuples{table="alarm_event"} 0',
    'redis_stream_length{stream="stream:biz:cmd"} 7',
    'consumer_lag 3',
    'biz_stream_lag 1',
    'biz_commands_total{kind="alarm.rule.patch",result="applied"} 4',
    'biz_commands_total{kind="master.device.patch",result="applied"} 6',
    'gen_points_generated_total{mode="B",profile="p"} 100',
    'gen_points_generated_total{mode="run",profile="p"} 50',
    'obs_collect_last_success_timestamp_seconds{store="redis"} 1700000000',
  ].join('\n');

  it('등재 이름만 요약 · 행당 바이트는 테이블 전체 행 수가 분모 · 0이면 계측 없음', () => {
    const m = summarizeFlow(parsePrometheusText(text));
    const t = m.clickhouse.tables.tag_raw;
    expect(perRowBytes(t?.bytesOnDisk ?? null, t?.rows ?? null)).toBe(10);
    const pg = m.postgres.tables.alarm_event;
    expect(pg?.heapBytes).toBe(800);
    expect(pg?.indexBytes).toBe(200);
    expect(perRowBytes(1000, pg?.liveTuples ?? null)).toBeNull();
    expect(m.redis.streamLength).toEqual({ 'stream:biz:cmd': 7 });
    expect(m.redis.consumerLag).toBe(3);
    expect(m.redis.bizStreamLag).toBe(1);
    expect(m.redis.bizCommands).toEqual({ applied: 10 });
    expect(m.source.genByMode).toEqual({ B: 100, run: 50 });
    expect(m.collectedAt.redis).toBe(1_700_000_000);
    expect(m.collectedAt.postgres).toBeNull();
  });

  it('두 폴링 차 — run을 B와 따로 · 누적이 줄면 그 값만 null', () => {
    const a = { fetchedAt: 0, flow: summarizeFlow(parsePrometheusText(text)) };
    const b = {
      fetchedAt: 5_000,
      flow: summarizeFlow(
        parsePrometheusText(
          text
            .replace('mode="B",profile="p"} 100', 'mode="B",profile="p"} 600')
            .replace('mode="run",profile="p"} 50', 'mode="run",profile="p"} 10'),
        ),
      ),
    };
    const r = flowMetricRates(a, b);
    expect(r.genPpsByMode.B).toBe(100);
    expect(r.genPpsByMode.run).toBeNull();
    expect(flowMetricRates(null, b).genPpsByMode.B).toBeNull();
  });
});

// ── 소켓 래퍼 — 진입 subscribe_flow · 이탈 unsubscribe_flow · 재연결 재구독 ──

class FakeWs {
  static OPEN = 1;
  static instances: FakeWs[] = [];
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { code: number }) => void) | null = null;
  constructor(public url: string) {
    FakeWs.instances.push(this);
  }
  send(s: string) {
    this.sent.push(JSON.parse(s));
  }
  close() {}
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

describe('흐름 구독 — 소켓 래퍼', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('구독 → 확인 프레임 → 해지 · 재연결 뒤 재전송', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWs);
    const { realtimeSocket, useConnectionStore } = await import('../lib/realtime-socket');
    const frames: FlowFrameBody[] = [];
    const off = realtimeSocket.onFlow((f) => frames.push(f));

    realtimeSocket.subscribeFlow(); // 연결 전 — 보낼 곳이 없어도 희망은 남는다
    expect(useConnectionStore.getState().flow).toBe('requesting');
    realtimeSocket.start();
    const ws1 = FakeWs.instances.at(-1) as FakeWs;
    ws1.open();
    expect(ws1.sent).toContainEqual({ type: 'subscribe_flow' });

    ws1.onmessage?.({ data: JSON.stringify(frame(1000)) });
    expect(useConnectionStore.getState().flow).toBe('subscribed');
    expect(frames).toHaveLength(1);

    // 끊김 → 요청 중 → 재연결 뒤 subscribe_flow 재전송
    ws1.onclose?.({ code: 1006 });
    expect(useConnectionStore.getState().flow).toBe('requesting');
    vi.advanceTimersByTime(1_000);
    const ws2 = FakeWs.instances.at(-1) as FakeWs;
    expect(ws2).not.toBe(ws1);
    ws2.open();
    expect(ws2.sent).toContainEqual({ type: 'subscribe_flow' });

    realtimeSocket.unsubscribeFlow();
    expect(ws2.sent).toContainEqual({ type: 'unsubscribe_flow' });
    expect(useConnectionStore.getState().flow).toBe('off');
    // 해지 뒤 늦게 온 프레임은 버린다
    ws2.onmessage?.({ data: JSON.stringify(frame(2000)) });
    expect(frames).toHaveLength(1);

    off();
    realtimeSocket.stop();
  });
});
