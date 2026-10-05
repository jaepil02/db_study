// EXP-FLOW 화면 상태 변환 — 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW 표시 계약 · docs/07_api/11_websocket.md §흐름 이벤트
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { textWidth } from '../components/experiments/flow/diagram-layout';
import { HeadlineRow } from '../components/experiments/flow/flow-panels';
import {
  bizSrcLines,
  compareBars,
  footnoteText,
  headlines,
  koBytes,
  koCount,
  latencyValue,
  latestLines,
  markText,
  NO_BIZ_TEXT,
  NO_READ_TEXT,
  offPaths,
  pctText,
  perSecText,
  pillarFootText,
  readCacheLines,
  readCacheTip,
  readMissLabel,
  readSrcLines,
  readSrcTip,
  replyLines,
  sourceLines,
  sourceTip,
  storeLines,
  waitLine,
  whyCards,
  workerLines,
} from '../components/experiments/flow/node-lines';
import {
  animScale,
  applyFlowFrame,
  arriveAt,
  BATCH_STAGES,
  batchPlan,
  batchStageAverages,
  bizOutcome,
  bizPlan,
  bizStageAverages,
  durationText,
  emptyFlowState,
  FLOW_AUTOGEN_OFF_NOTICE,
  FLOW_NO_DATA_WARNING,
  FLOW_RING,
  flowMetricRates,
  flowNotice,
  flowRates,
  flowSubStatus,
  flowSwitchFlags,
  invalidationRate,
  isAckFrame,
  maxBackpressure,
  noSummary,
  planProgress,
  plcRawLag,
  readRates,
  readShare,
  restNode,
  sensorQuiet,
  sourcePps,
  summarizeFlow,
  trackRate,
} from '../lib/flow';
import { parsePrometheusText } from '../lib/metrics-parser';
import { isActive } from '../lib/runs';
import type {
  FlowBatchSummaryBody,
  FlowBizSummaryBody,
  FlowFrameBody,
  FlowTotalsEntryBody,
} from '../lib/shared';
import { FlowFrame, RUN_STATUSES } from '../lib/shared';

/** 노드 줄 글자만(줄 종류는 test/flow-layout.test.ts가 본다) */
const tx = (lines: readonly { text: string }[]): string[] => lines.map((l) => l.text);

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

  it('창 끝은 마지막 샘플 — 요약 간격 · 시계 차이로 지금이 앞서도 초당 값이 줄지 않는다 · 3초 넘게 끊기면 지금까지 민다', () => {
    // 1.2초마다 1만 행(초당 약 8,333) — 브라우저가 추정한 지금이 마지막 요약보다 1.6초 앞서 있다
    let s = emptyFlowState();
    for (let i = 0; i <= 12; i++)
      s = applyFlowFrame(s, frame(i * 1_200, { totals: [ingestTotals(1, i * 10_000, i)] }), i * 1_200).state;
    const last = 12 * 1_200;
    const track = s.totals['worker-1|ingest'] as never;
    const truth = 10_000 / 1.2;
    expect(trackRate(track, 'rows', last)).toBeCloseTo(truth, 0);
    // 옛 계산(창 끝 = 지금)은 1.6초만큼 분모가 늘어 약 14% 작게 나왔다 — 이제 같은 값
    expect(trackRate(track, 'rows', last + 1_600)).toBeCloseTo(truth, 0);
    // 4초 동안 요약이 없다 — 멈춤으로 보고 값이 줄어든다
    expect(trackRate(track, 'rows', last + 4_000) as number).toBeLessThan(truth * 0.75);
  });

  it('공장 센서 노드는 흐름 요약(rows)과 같은 원천 — 메트릭 보낸 쪽 계수는 툴팁에만', () => {
    expect(tx(sourceLines(10_004))).toEqual(['공장 센서', '초당 10,004개 보냄']);
    const tip = sourceTip(10_004, { genPpsByMode: { run: 10_000 } } as never);
    expect(tip).toContain('최근 10초 흐름 요약 기준');
    expect(tip).toContain('보낸 쪽 계수(메트릭 5초 차분) 초당 10,004개');
    expect(tip).toContain('직접 보내 보기 몫 초당 10,000개');
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
    // 업무 커밋 · 결과 갈래도 두 role 합(PostgreSQL 노드 · 카드의 업무 건수)
    expect(r.applied).toBeCloseTo(2.5);
    expect(r.rejected).toBe(0);
  });

  describe('드문 트랙(업무 명령) — 최근 10초 안 증가분 ÷ 10초', () => {
    // 이 api는 구독 전에 명령 5건을 처리했다(누적 5) — 구독 뒤 첫 명령이 6번째
    type BizCounts = Record<
      'startedAt' | 'applied' | 'rejected' | 'expired' | 'failed' | 'duplicates',
      number
    >;
    const bizTotals = (commands: number, over: Partial<BizCounts> = {}): FlowTotalsEntryBody => ({
      source: 'worker-1',
      role: 'biz-writer',
      startedAt: 1,
      commands,
      applied: commands,
      rejected: 0,
      expired: 0,
      failed: 0,
      duplicates: 0,
      ...over,
    });
    // 센서 프레임이 1.2초마다 오는 중(업무 트랙은 없다)
    const sensorOnly = () => {
      let s = emptyFlowState();
      for (let i = 0; i <= 10; i++)
        s = applyFlowFrame(
          s,
          frame(i * 1_200, { totals: [ingestTotals(1, i * 10_000, i)] }),
          i * 1_200,
        ).state;
      return s;
    };

    it('업무 1건 — 구독 뒤 첫 명령 하나만 와도 0.1 · 10초 동안 유지 · 그 뒤 0', () => {
      let s = sensorOnly();
      const at = 13_000;
      s = applyFlowFrame(s, frame(at, { biz: [biz(6)], totals: [bizTotals(6)] }), at).state;
      expect(s.totals['worker-1|biz-writer']?.samples).toHaveLength(2);
      for (const now of [at, at + 500, at + 4_000, at + 9_000])
        expect(flowRates(s.totals, now).commands).toBeCloseTo(0.1);
      expect(perSecText(flowRates(s.totals, at + 500).commands)).toBe('0.1');
      expect(flowRates(s.totals, at + 10_500).commands).toBe(0);
      // 센서 줄은 지금 방식 그대로(두 샘플 사이 실제 시간)
      expect(flowRates(s.totals, 12_000).rows).toBeCloseTo(10_000 / 1.2, 0);
    });

    it('간격이 긴 두 번째 명령 — 앞 샘플이 창 밖이어도 분모는 10초(옛 계산은 1 ÷ 60초 → "0.1 미만")', () => {
      let s = sensorOnly();
      s = applyFlowFrame(s, frame(13_000, { biz: [biz(6)], totals: [bizTotals(6)] }), 13_000).state;
      s = applyFlowFrame(s, frame(73_000, { biz: [biz(7)], totals: [bizTotals(7)] }), 73_000).state;
      expect(flowRates(s.totals, 73_100).commands).toBeCloseTo(0.1);
      expect(flowRates(s.totals, 73_100).applied).toBeCloseTo(0.1);
    });

    it('결과 갈래 · 중복도 기준점에서 뺀다 — 거절 1 · 실패 1 · 만료 1(중복)', () => {
      const s = applyFlowFrame(
        emptyFlowState(),
        frame(5_000, {
          biz: [
            biz(1, { result: 'alarm.rule_not_found' }),
            biz(2, { result: 'common.postgres_unavailable' }),
            biz(3, { result: 'expired', duplicate: true }),
          ],
          totals: [bizTotals(10, { applied: 4, rejected: 2, failed: 1, expired: 3, duplicates: 2 })],
        }),
        5_000,
      ).state;
      const r = flowRates(s.totals, 5_000);
      expect(r.commands).toBeCloseTo(0.3);
      expect(r.applied).toBe(0);
      expect(r.rejected).toBeCloseTo(0.1);
      expect(r.failed).toBeCloseTo(0.1);
      expect(r.expired).toBeCloseTo(0.1);
    });

    it('업무 0건 — 트랙이 없으면 null("—") · 센서 값은 그대로', () => {
      const r = flowRates(sensorOnly().totals, 12_000);
      expect(r.commands).toBeNull();
      expect(perSecText(r.commands)).toBe('—');
      expect(r.rows).toBeCloseTo(10_000 / 1.2, 0);
    });

    it('업무 0건 · 구독 확인됨 — 트랙이 없으면 업무 요청 · 업무 커밋은 0("—"는 고장으로 읽힌다) · 연결 전 · 끊김은 "—"', () => {
      const s = sensorOnly();
      const on = flowRates(s.totals, 12_000, { subscribed: true });
      expect(on.commands).toBe(0);
      expect(on.applied).toBe(0);
      expect(perSecText(on.commands)).toBe('0');
      // 숫자 4 · 업무 요청 노드 · 왜 나눌까 PostgreSQL 카드의 업무 칸
      expect(
        headlines({ rates: on, lag: 0, bizLag: null, slowing: false, e2eP50: null, e2eRows: null }).find(
          (h) => h.key === 'biz',
        ),
      ).toMatchObject({ value: '0', text: '업무 요청이 없어요' });
      expect(bizSrcLines(on)[2]?.text).toBe('초당 0건');
      expect(whyCards(on, { collectorLatest: false })[2]?.now).toContain('업무 0건');
      // 구독 확인 전 · 끊김(subscribed 아님) — 모른다
      expect(flowRates(s.totals, 12_000).commands).toBeNull();
      expect(flowRates(s.totals, 12_000, { subscribed: false }).applied).toBeNull();
    });

    it('구독 확인됨이어도 트랙이 있는데 값을 모르면 "—" — 버린 요약(dropped.biz)', () => {
      const s = applyFlowFrame(
        emptyFlowState(),
        frame(5_000, { biz: [biz(6)], dropped: { batches: 0, biz: 3 }, totals: [bizTotals(9)] }),
        5_000,
      ).state;
      expect(flowRates(s.totals, 5_000, { subscribed: true }).commands).toBeNull();
    });

    it('창에서 버린 업무 요약이 있으면 기준점을 만들지 않는다 — 몇 건이 이 트랙 몫인지 모른다', () => {
      const s = applyFlowFrame(
        emptyFlowState(),
        frame(5_000, { biz: [biz(6)], dropped: { batches: 0, biz: 3 }, totals: [bizTotals(9)] }),
        5_000,
      ).state;
      expect(flowRates(s.totals, 5_000).commands).toBeNull();
    });

    it('끊김 — 요약이 끊겨도 창은 지금까지 민다 · 재기동이면 한 창 건너뛴다', () => {
      let s = applyFlowFrame(
        emptyFlowState(),
        frame(1_000, { biz: [biz(6)], totals: [bizTotals(6)] }),
        1_000,
      ).state;
      s = applyFlowFrame(s, frame(2_000, { biz: [biz(7)], totals: [bizTotals(7)] }), 2_000).state;
      expect(flowRates(s.totals, 2_000).commands).toBeCloseTo(0.2);
      // 아무 프레임도 오지 않은 채 30초 — 0으로 떨어진다(멈춘 값이 남지 않는다)
      expect(flowRates(s.totals, 32_000).commands).toBe(0);
      s = applyFlowFrame(
        s,
        frame(40_000, { biz: [biz(1)], totals: [bizTotals(1, { startedAt: 2 })] }),
        40_000,
      ).state;
      expect(s.totals['worker-1|biz-writer']?.restarts).toBe(1);
      expect(flowRates(s.totals, 40_000).commands).toBeNull();
    });
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
    // 무효화는 ④ 칸 점 길을 반씩 두 다리로 지난다(결과 알림 단계 없음 — stage는 둘 다 invalidateMs)
    expect(p.legs.map((l) => l.to)).toEqual(['pgTx', 'cache', 'result', 'api']);
    expect(p.legs.filter((l) => l.stage === 'replyMs')).toHaveLength(0);
    expect(p.legs.filter((l) => l.stage === 'invalidateMs').map((l) => l.ms / p.scale)).toEqual([0.5, 0.5]);
    // cmdId가 있어도 role biz-writer면 명령 경로
    const w = bizPlan(biz(2, { role: 'biz-writer' }));
    expect(w.legs[0]?.to).toBe('bizStream');
  });

  it('움직임 줄이기 — 점은 가장 오래 머무는 다리의 도착 노드에 멈춘다(대기줄 밀림이면 ① · 평소 ClickHouse · 업무는 트랜잭션)', () => {
    expect(restNode(batchPlan(batch(1)))).toBe('ch');
    expect(restNode(batchPlan(batch(1, { stages: { ...batch(1).stages, streamWaitMs: 2_788_236 } })))).toBe(
      'stream',
    );
    expect(restNode(bizPlan(biz(1)))).toBe('pgTx');
    const empty = batchPlan(
      batch(1, {
        stages: {
          streamWaitMs: null,
          decodeMs: null,
          chInsertMs: null,
          controlCopyMs: null,
          latestWriteMs: null,
          alarmMs: null,
        },
      }),
    );
    expect(restNode(empty)).toBe('src');
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
    expect(flowSubStatus('closed', 'requesting')).toBe('disconnected');
    // 첫 연결 전 — 끊김이 아니라 연결 중(끊김 띠 · 흐림 없음)
    expect(flowSubStatus('idle', 'off')).toBe('connecting');
    expect(flowSubStatus('connecting', 'requesting')).toBe('connecting');
    expect(noSummary({ lastFrameAt: 0 }, 'subscribed', 9_999)).toBe(false);
    expect(noSummary({ lastFrameAt: 0 }, 'subscribed', 10_000)).toBe(true);
    expect(noSummary({ lastFrameAt: 0 }, 'disconnected', 20_000)).toBe(false);
  });

  it('센서가 안 온다 — 배치를 한 번도 못 받았거나 마지막 배치가 10초 넘게 지났다(구독 중일 때만)', () => {
    expect(sensorQuiet({ lastBatchAt: null }, 'subscribed', 0)).toBe(true);
    expect(sensorQuiet({ lastBatchAt: 0 }, 'subscribed', 9_999)).toBe(false);
    expect(sensorQuiet({ lastBatchAt: 0 }, 'subscribed', 10_000)).toBe(true);
    expect(sensorQuiet({ lastBatchAt: null }, 'requesting', 0)).toBe(false);
    expect(sensorQuiet({ lastBatchAt: null }, 'disconnected', 0)).toBe(false);
  });

  it('알림 한 줄 — off + 무데이터면 차분한 안내(경고 색 아님) · on + 무데이터면 경고 그대로 · health 모름도 경고 그대로', () => {
    const base = {
      sub: 'subscribed' as const,
      silent: false,
      ackOverdue: false,
      sensorQuiet: false,
      flowRunActive: false,
    };
    // off + 무데이터(진입 직후 — 확인 프레임만 받음 · 10초 뒤 요약 없음까지)
    const calm = { text: FLOW_AUTOGEN_OFF_NOTICE, tone: 'info' };
    expect(flowNotice({ ...base, sensorQuiet: true, sensorAutogen: 'off' })).toEqual(calm);
    expect(flowNotice({ ...base, sensorQuiet: true, silent: true, sensorAutogen: 'off' })).toEqual(calm);
    expect(FLOW_AUTOGEN_OFF_NOTICE).toBe(
      "센서 자동 생성이 꺼져 있어요 — 오른쪽 위 '직접 보내 보기'로 데이터를 보내 보세요",
    );
    // on + 무데이터 — 지금 경고 그대로(진입 직후 무알림 · 10초 요약 없음이면 경고)
    const warn = { text: FLOW_NO_DATA_WARNING, tone: 'warn' };
    expect(flowNotice({ ...base, sensorQuiet: true, sensorAutogen: 'on' })).toBeNull();
    expect(flowNotice({ ...base, sensorQuiet: true, silent: true, sensorAutogen: 'on' })).toEqual(warn);
    expect(flowNotice({ ...base, sensorQuiet: true, silent: true, sensorAutogen: null })).toEqual(warn);
    expect(FLOW_NO_DATA_WARNING).toBe('10초째 새 데이터가 오지 않아요 — 센서 데이터 적재가 멈췄을 수 있어요');
    // off라도 데이터가 오면(직접 보내 보기 중) 알림 없음 · 끊김은 늘 먼저
    expect(flowNotice({ ...base, sensorAutogen: 'off' })).toBeNull();
    expect(flowNotice({ ...base, sub: 'disconnected', sensorQuiet: true, sensorAutogen: 'off' })?.tone).toBe(
      'warn',
    );
    // 구독 확인이 늦으면 확인 지연(꺼짐 안내는 구독이 선 뒤에만)
    expect(flowNotice({ ...base, sub: 'requesting', ackOverdue: true, sensorAutogen: 'off' })?.text).toBe(
      '연결 확인이 늦어지고 있어요',
    );
  });

  it('알림 한 줄 — 직접 보내 보기(flow 실행)가 running · stopping이면 꺼짐 안내를 숨긴다 · 그동안의 침묵은 다른 규칙 그대로', () => {
    const quietOff = {
      sub: 'subscribed' as const,
      silent: false,
      ackOverdue: false,
      sensorQuiet: true,
      sensorAutogen: 'off' as const,
    };
    // 화면이 넘기는 값 — 이 화면 종류(flow) 실행의 status가 running · stopping일 때만 true(lib/runs isActive)
    expect(RUN_STATUSES.filter(isActive)).toEqual(['running', 'stopping']);
    // 실행 없음 · 종결 — 꺼짐 안내
    expect(flowNotice({ ...quietOff, flowRunActive: false })?.text).toBe(FLOW_AUTOGEN_OFF_NOTICE);
    // 실행 중(준비 단계라 아직 배치가 없다) — 꺼짐 안내 없음
    expect(flowNotice({ ...quietOff, flowRunActive: true })).toBeNull();
    // 실행 중인데 10초 넘게 아무 프레임도 없다 — 꺼짐 안내 대신 요약 없음 경고(보내는 중의 침묵은 고장일 수 있다)
    expect(flowNotice({ ...quietOff, silent: true, flowRunActive: true })).toEqual({
      text: FLOW_NO_DATA_WARNING,
      tone: 'warn',
    });
    // 끊김은 실행과 무관하게 먼저
    expect(flowNotice({ ...quietOff, sub: 'disconnected', flowRunActive: true })?.tone).toBe('warn');
    // on이면 실행 상태와 무관하게 지금 규칙 그대로
    expect(flowNotice({ ...quietOff, sensorAutogen: 'on', flowRunActive: false })).toBeNull();
    expect(flowNotice({ ...quietOff, sensorAutogen: 'on', silent: true, flowRunActive: true })?.text).toBe(
      FLOW_NO_DATA_WARNING,
    );
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

  it('등재 이름만 요약 · 테이블별 행 수 · 크기', () => {
    const m = summarizeFlow(parsePrometheusText(text));
    const t = m.clickhouse.tables.tag_raw;
    expect(t?.bytesOnDisk).toBe(1000);
    expect(t?.rows).toBe(100);
    const pg = m.postgres.tables.alarm_event;
    expect(pg?.heapBytes).toBe(800);
    expect(pg?.indexBytes).toBe(200);
    expect(m.redis.streamLength).toEqual({ 'stream:biz:cmd': 7 });
    expect(m.redis.consumerLag).toBe(3);
    expect(m.redis.bizStreamLag).toBe(1);
    expect(m.redis.bizCommands).toEqual({ applied: 10 });
    expect(m.source.genByMode).toEqual({ B: 100, run: 50 });
    expect(m.collectedAt.redis).toBe(1_700_000_000);
    expect(m.collectedAt.postgres).toBeNull();
    expect(m.e2e).toEqual({ p50: null, p95: null, p99: null, rows: null });
  });

  it('지연(E2E) — e2e_latency 분위수 3 · e2e_latency_rows', () => {
    const m = summarizeFlow(
      parsePrometheusText(
        [
          'e2e_latency{quantile="0.5"} 0.12',
          'e2e_latency{quantile="0.95"} 0.4',
          'e2e_latency{quantile="0.99"} 0.9',
          'e2e_latency_rows 5000',
        ].join('\n'),
      ),
    );
    expect(m.e2e).toEqual({ p50: 0.12, p95: 0.4, p99: 0.9, rows: 5000 });
  });

  it('발생원 초당 — Collector + 대기줄로 가는 생성 모드(B · C · run)만 · 모드 A는 레지스터 갱신이라 두 번 세지 않는다', () => {
    const r = (collectorPps: number | null, genPpsByMode: Record<string, number | null>) =>
      ({ collectorPps, genPpsByMode }) as never;
    // 실측 모양(2026-10-03): 모드 A 생성 10,000/초 + Collector 발행 10,000/초 → 행은 1만/초
    expect(sourcePps(r(10_000, { A: 10_000 }))).toBe(10_000);
    expect(sourcePps(r(10_000, { A: 10_000, run: 1_000 }))).toBe(11_000);
    expect(sourcePps(r(null, { B: 5_000, C: 10, D: 99_999, standalone: 99_999 }))).toBe(5_010);
    expect(sourcePps(r(null, { A: 10_000 }))).toBeNull();
    expect(sourcePps(null)).toBeNull();
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

  // 조회 줄(설계 §9.2 · 명세 08 조회 줄 계약) — 세 계열 모두 요청 건수(result) · rlt_latest_points_served_total은 점 수라 툴팁에만
  type R3 = { s: [number, number, number]; l: [number, number, number, number]; m: [number, number, number] };
  const reads = ({ s, l, m }: R3, points: number) =>
    [
      `tsq_cache_requests_total{result="hit"} ${s[0]}`,
      `tsq_cache_requests_total{result="miss"} ${s[1]}`,
      `tsq_cache_requests_total{result="error"} ${s[2]}`,
      `rlt_latest_requests_total{result="hit"} ${l[0]}`,
      `rlt_latest_requests_total{result="restored"} ${l[1]}`,
      `rlt_latest_requests_total{result="bypass"} ${l[2]}`,
      `rlt_latest_requests_total{result="error"} ${l[3]}`,
      `mst_cache_requests_total{result="hit"} ${m[0]}`,
      `mst_cache_requests_total{result="miss"} ${m[1]}`,
      `mst_cache_requests_total{result="error"} ${m[2]}`,
      `rlt_latest_points_served_total{freshness="fresh"} ${points}`,
      'rlt_latest_points_served_total{freshness="stale"} 0',
    ].join('\n');
  const zero: R3 = { s: [0, 0, 0], l: [0, 0, 0, 0], m: [0, 0, 0] };
  // 리드 실측(2026-10-03) — flow 30초 · 조회 20/초: rlt hit 240 · tsq hit 179 miss 61 · mst hit 90 miss 30
  const real: R3 = { s: [179, 61, 0], l: [240, 0, 0, 0], m: [90, 30, 0] };

  it('조회 계열 요약 — result · freshness별 누적', () => {
    const m = summarizeFlow(parsePrometheusText(reads(real, 48_000)));
    expect(m.reads).toEqual({
      series: { hit: 179, miss: 61, error: 0 },
      latest: { hit: 240, restored: 0, bypass: 0, error: 0 },
      master: { hit: 90, miss: 30, error: 0 },
      latestPoints: { fresh: 48_000, stale: 0 },
    });
    expect(summarizeFlow(parsePrometheusText(text)).reads).toEqual({
      series: null,
      latest: null,
      master: null,
      latestPoints: null,
    });
  });

  it('조회 줄 숫자 — 세 계열 합의 차분 · 바로 응답 = hit 합 · ClickHouse = 시계열 miss + 지금 값 restored + bypass · PostgreSQL = 목록 miss', () => {
    const a = { fetchedAt: 0, flow: summarizeFlow(parsePrometheusText(reads(zero, 0))) };
    const b = { fetchedAt: 30_000, flow: summarizeFlow(parsePrometheusText(reads(real, 48_000))) };
    const rr = readRates(flowMetricRates(a, b));
    expect(rr.requests).toBeCloseTo(20);
    expect(rr.hit).toBeCloseTo(509 / 30);
    expect(rr.chMiss).toBeCloseTo(61 / 30);
    expect(rr.pgMiss).toBeCloseTo(1);
    expect(rr.bypass).toBe(0);
    expect(rr.latestPoints).toBeCloseTo(1_600);
    // 노드 줄은 제목 → 역할 → 숫자 순서(diagram-layout lineKind)
    expect(tx(readSrcLines(rr))).toEqual(['사람의 조회 요청(api)', 'Redis부터 먼저 봐요', '초당 20.0건']);
    expect(tx(readCacheLines(rr))).toEqual([
      '⑤ 조회 사본(캐시)',
      '있으면 바로 응답 85%',
      '없으면 DB까지 15%',
    ]);
    // 줄기 아래 두 줄 — 무엇을 하나 · 어느 DB로 몇 %
    expect(readMissLabel(rr)).toEqual([
      '없으면 읽어 와 사본 담기',
      'ClickHouse(센서) 10% · PostgreSQL(업무 목록) 5%',
    ]);
    // 점 수는 노드에 쓰지 않고 툴팁에만(요청 수와 헷갈리지 않게)
    expect(tx(readSrcLines(rr)).join(' ')).not.toContain('1,600');
    expect(readSrcTip(rr)).toContain('점 초당 1,600개(요청 수가 아니에요)');
    // 지금 값 restored · bypass는 ClickHouse 쪽 · bypass는 툴팁에 "Redis를 건너뜀(스위치)"
    const sw: R3 = { s: [0, 0, 0], l: [50, 25, 25, 0], m: [0, 0, 0] };
    const c = { fetchedAt: 30_000, flow: summarizeFlow(parsePrometheusText(reads(sw, 0))) };
    const r2 = readRates(flowMetricRates(a, c));
    expect(readShare(r2.hit, r2)).toBe(50);
    expect(readShare(r2.chMiss, r2)).toBe(50);
    expect(readCacheTip(r2)).toContain('Redis를 건너뜀(스위치) 25%');
    expect(readCacheTip(rr)).not.toContain('건너뜀');
    // 첫 폴링(앞 응답 없음) · 원천 없음 — 만들지 않는다
    const first = readRates(flowMetricRates(null, b));
    expect(first.requests).toBeNull();
    expect(readCacheLines(first)[1]?.text).toBe('있으면 바로 응답 —%');
    expect(readSrcLines(null)[2]?.text).toBe('초당 —건');
    expect(readMissLabel(null)[1]).toContain('—%');
    // 조회가 없으면 보내 보라는 한 줄 · 비율은 모름
    const idle = readRates(flowMetricRates(b, { ...b, fetchedAt: 35_000 }));
    expect(idle.requests).toBe(0);
    expect(readShare(idle.hit, idle)).toBeNull();
    expect(readMissLabel(idle)).toEqual([NO_READ_TEXT]);
    expect(NO_READ_TEXT).toBe('조회 요청이 없어요 — 직접 보내 보기로 보내 보세요');
    // 옛 BFF 응답(reads 없음)도 받는다
    const old = { fetchedAt: 0, flow: { ...a.flow, reads: undefined } } as never;
    expect(readRates(flowMetricRates(old, old)).requests).toBeNull();
  });

  it('조회 비율 문구 — 정수 % · 1% 미만 · 모름 · Redis 읽기 실패는 툴팁에만', () => {
    expect(pctText(null)).toBe('—%');
    expect(pctText(0)).toBe('0%');
    expect(pctText(0.2)).toBe('1% 미만');
    expect(pctText(99.6)).toBe('100%');
    const rr = { requests: 10, hit: 8, chMiss: 1, bypass: 0, pgMiss: 0, error: 1, latestPoints: null };
    expect(readCacheTip(rr)).toContain('Redis 읽기 실패 10%');
    expect(readCacheTip({ ...rr, error: 0 })).not.toContain('실패');
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

describe('숫자 4 · 모아서 vs 하나씩 원천', () => {
  it('처리 방식 비교 — 단계별 평균은 그 단계가 있는 표본만 · 합 · 표본 수 · 단계 순서 유지', () => {
    let s = emptyFlowState();
    s = applyFlowFrame(
      s,
      frame(1, {
        batches: [batch(1), batch(2, { stages: { ...batch(2).stages, decodeMs: null, controlCopyMs: 10 } })],
      }),
      1,
    ).state;
    const a = batchStageAverages(s.timeline);
    expect(a.n).toBe(2);
    expect(a.stages.map((x) => x.key)).toEqual(BATCH_STAGES.map((x) => x.key));
    expect(a.stages.find((x) => x.key === 'decodeMs')).toMatchObject({ avg: 4, n: 1 });
    expect(a.stages.find((x) => x.key === 'controlCopyMs')).toMatchObject({ avg: 10, n: 1 });
    expect(a.total).toBeCloseTo(12 + 4 + 64 + 10 + 3 + 6);
    const b = bizStageAverages([
      biz(1),
      biz(2, { stages: { queueWaitMs: 4, txMs: null, invalidateMs: 1.1, replyMs: 0.6 } }),
    ]);
    expect(b.stages.map((x) => x.key)).toEqual(['queueWaitMs', 'txMs', 'invalidateMs', 'replyMs']);
    expect(b.stages[0]?.avg).toBe(3);
    expect(b.stages[1]).toMatchObject({ avg: 4.2, n: 1 });
    expect(bizStageAverages([])).toMatchObject({ total: null, n: 0 });
  });

  it('캐시 무효화 키/초 — 최근 10초 링 버퍼 합 ÷ 10 · 버려진 업무 요약이 있으면 하한', () => {
    const items = [
      biz(1, { at: 95_000, invalidatedKeys: 3 }),
      biz(2, { at: 99_000, invalidatedKeys: 7 }),
      biz(3, { at: 80_000, invalidatedKeys: 100 }),
    ];
    expect(invalidationRate(items, 0, 100_000)).toEqual({ value: 1, lowerBound: false });
    expect(invalidationRate(items, 2, 100_000).lowerBound).toBe(true);
  });

  it('밀린 데이터 — plc:raw 랙은 마지막 배치 stream.lag · null이면 메트릭 · SW-01 대안이면 없음 · 백프레셔 0이면 밀리지 않음', () => {
    expect(plcRawLag(batch(1), 9)).toBe(3);
    expect(plcRawLag(batch(1, { stream: { length: 1, lag: null } }), 9)).toBe(9);
    expect(plcRawLag(batch(1, { stream: null }), 9)).toBeNull();
    expect(plcRawLag(null, 9)).toBe(9);
    expect(maxBackpressure(null)).toBeNull();
    expect(maxBackpressure({ a: 0 })).toBeNull();
    expect(maxBackpressure({ a: 0, b: 2 })).toBe(2);
  });
});

describe('화면 문구 — 쉬운 말 · 숫자는 크게 읽히게(설계 §4 용어표)', () => {
  const rates = {
    ...flowRates({}, 0),
    rows: 9_681,
    batches: 1,
    chRows: 9_681,
    latestWrites: 9_681,
    commands: 0,
    transitions: 0,
    applied: 0,
  };
  const FORBIDDEN = /Q\d|I2|EXP-|SW-|10\^|랙|lag|flusher|XACK|XADD|stream:|p50|백프레셔/;
  const noFlags = {
    controlCopyOff: false,
    collectorLatest: false,
    streamOff: false,
    directGateway: false,
    deadband: false,
    bizDirect: false,
  };

  it('초당 값 — 0 < v < 0.05는 "0.1 미만" · 0은 0 · 없음은 —', () => {
    expect(perSecText(0.02)).toBe('0.1 미만');
    expect(perSecText(0.05)).toBe('0.1');
    expect(perSecText(0)).toBe('0');
    expect(perSecText(null)).toBe('—');
    expect(perSecText(12.34)).toBe('12.3');
    expect(perSecText(1234.5)).toBe('1,235');
  });

  it('큰 수 · 크기 — "8,838만" · "10억" · "950MB"', () => {
    expect(koCount(9_681)).toBe('9,681');
    expect(koCount(88_381_000)).toBe('8,838만');
    expect(koCount(1e9)).toBe('10억');
    expect(koCount(1.23e9)).toBe('12.3억');
    expect(koCount(null)).toBe('—');
    expect(koBytes(950_000_000)).toBe('950MB');
    expect(koBytes(3_800_000)).toBe('3.8MB');
    expect(koBytes(2.5e9)).toBe('2.5GB');
    expect(koBytes(512)).toBe('512B');
  });

  it('큰 수 · 크기 — 반올림한 뒤 단위를 다시 고른다(10,000만 → 1억 · 1,000MB → 1.0GB · 10.0MB → 10MB)', () => {
    expect(koCount(99_995_000)).toBe('1억');
    expect(koCount(99_994_999)).toBe('9,999만');
    expect(koCount(9_996_000_000)).toBe('100억');
    expect(koCount(9_999.6)).toBe('1만');
    expect(koBytes(999_600_000)).toBe('1.0GB');
    expect(koBytes(999_400_000)).toBe('999MB');
    expect(koBytes(9_960_000)).toBe('10MB');
    expect(koBytes(999.6)).toBe('1.0KB');
  });

  it('숫자 4 — 센서 · 밀린 데이터 · 측정 → 저장 · 업무 요청 · 밀리면 주황 문장', () => {
    const h = headlines({ rates, lag: 0, bizLag: 0, slowing: false, e2eP50: 0.84, e2eRows: 1_200 });
    expect(h.map((x) => x.label)).toEqual([
      '센서 데이터',
      'Redis에 밀린 데이터',
      '측정 → 저장까지',
      '업무 요청',
    ]);
    expect(h[0]?.value).toBe('9,681');
    expect(h[1]?.text).toBe('잘 처리하고 있어요');
    expect(h[2]?.value).toBe('0.8');
    // 짧은 고정 문장(.omc/plans/web-ux-polish.md §2.3 — 큰 숫자 28 옆에서 잘리지 않게) · 뜻은 이름 · 단위와 함께 그대로
    expect([h[0]?.text, h[2]?.text]).toEqual(['초당 들어오는 양', '보통 걸리는 시간']);
    // 1440 × 900 카드 안 폭 245 − 큰 숫자 · 단위(약 120)에 한 줄로 드는 폭(13px 보수적 어림) — 넘으면 두 줄까지(잘림 없음)
    for (const x of h) expect(textWidth(x.text, 13), x.text).toBeLessThanOrEqual(130);
    const slow = headlines({
      rates: null,
      lag: 12_000,
      bizLag: null,
      slowing: true,
      e2eP50: null,
      e2eRows: null,
    });
    expect(slow[1]).toMatchObject({ value: '1만', warn: true, text: '처리가 밀리는 중이에요' });
    expect(slow[2]?.text).toBe('아직 잰 값이 없어요');
    for (const x of [...h, ...slow]) expect(`${x.label} ${x.text}`).not.toMatch(FORBIDDEN);
  });

  it('숫자 4 — 명세 08 §숫자 4 표: 밀림은 숫자 없는 고정 문장(큰 숫자를 두 번 말하지 않음 · R15) · 업무 N건 덧붙임(더하지 않음) · e2e 행 0이면 "—" · 업무 0 · 거절 · 실패 · 시간 초과는 툴팁', () => {
    const back = headlines({ rates, lag: 340, bizLag: 0, slowing: false, e2eP50: 0.84, e2eRows: 1_200 });
    expect(back[1]).toMatchObject({ value: '340', text: '아직 처리 안 된 양', warn: false });
    const big = headlines({ rates, lag: 150_000, bizLag: 0, slowing: false, e2eP50: 0.84, e2eRows: 1_200 });
    expect(big[1]).toMatchObject({ value: '15만', text: '아직 처리 안 된 양' });
    expect(big[1]?.text).not.toMatch(/\d/);
    const both = headlines({ rates, lag: 340, bizLag: 12, slowing: false, e2eP50: 0.84, e2eRows: 1_200 });
    expect(both[1]).toMatchObject({ value: '340', text: '아직 처리 안 된 양 · 업무 12건' });
    const zeroBiz = headlines({ rates, lag: 0, bizLag: 3, slowing: false, e2eP50: 0.84, e2eRows: 1_200 });
    expect(zeroBiz[1]?.text).toBe('잘 처리하고 있어요 · 업무 3건');
    const bp = headlines({ rates, lag: 340, bizLag: 12, slowing: true, e2eP50: 0.84, e2eRows: 1_200 });
    expect(bp[1]).toMatchObject({ text: '처리가 밀리는 중이에요 · 업무 12건', warn: true });
    // e2e_latency_rows 0 — 게이지가 비었다(0.0초로 보이지 않는다)
    const empty = headlines({ rates, lag: 0, bizLag: 0, slowing: false, e2eP50: 0, e2eRows: 0 });
    expect(empty[2]).toMatchObject({ value: '—', text: '아직 잰 값이 없어요' });
    // 업무 — 0이면 "업무 요청이 없어요" · 거절 · 저장 못 함 · 시간 초과 초당은 0이 아닐 때만 툴팁
    const idle = headlines({
      rates: { ...rates, commands: 0, rejected: 0, failed: 0, expired: 0 },
      lag: 0,
      bizLag: 0,
      slowing: false,
      e2eP50: 0.84,
      e2eRows: 1_200,
    });
    expect(idle[3]).toMatchObject({ value: '0', text: '업무 요청이 없어요', tip: undefined });
    const bad = headlines({
      rates: { ...rates, commands: 2, rejected: 0.5, failed: 0, expired: 0.1 },
      lag: 0,
      bizLag: 0,
      slowing: false,
      e2eP50: 0.84,
      e2eRows: 1_200,
    });
    expect(bad[3]).toMatchObject({
      value: '2.0',
      text: '하나씩 순서대로 처리',
      tip: '거절 초당 0.5건 · 시간 초과 초당 0.1건',
    });
  });

  it('숫자 4 — 측정 → 저장까지가 60초 이상이면 "46분 28초" 한 덩어리(단위 칸 없음 · durationText) · 60초 미만은 "0.6" + "초" 그대로(§9 P3)', () => {
    const at = (sec: number) =>
      headlines({ rates, lag: 0, bizLag: 0, slowing: false, e2eP50: sec, e2eRows: 1_200 })[2];
    // 60초 미만 — 지금 그대로(10초 미만 소수 1자리 · 그 위 정수 + 단위 칸 "초")
    expect(at(0.6)).toMatchObject({ value: '0.6', unit: '초', text: '보통 걸리는 시간' });
    expect(at(9.96)).toMatchObject({ value: '10', unit: '초' });
    expect(at(59.4)).toMatchObject({ value: '59', unit: '초' });
    // 보이는 정수 초가 60이 되는 자리부터 분 · 초 — "60 초"를 내지 않는다
    expect(at(59.5)).toMatchObject({ value: '1분 0초', unit: '' });
    expect(at(60)).toMatchObject({ value: '1분 0초', unit: '' });
    expect(at(2_788.236)).toMatchObject({
      value: '46분 28초',
      unit: '',
      text: '보통 걸리는 시간',
      tip: '측정 시각에서 저장 시각까지의 중간값이에요',
    });
    expect(at(3_700)).toMatchObject({ value: '1시간 2분', unit: '' });
    // 형식은 durationText 그대로(재사용 — 같은 시간은 화면 어디서나 같은 글자)
    for (const sec of [59.5, 125.4, 2_788.236, 10_920])
      expect(latencyValue(sec).value).toBe(durationText(Math.round(sec) * 1000));
    // 비면 지금 그대로 "—" + "초"
    expect(headlines({ rates, lag: 0, bizLag: 0, slowing: false, e2eP50: 0, e2eRows: 0 })[2]).toMatchObject({
      value: '—',
      unit: '초',
    });
    // 화면 — 단위가 빈 칸은 단위 글자 상자를 그리지 않는다(큰 숫자 옆 빈 틈 없음) · 다른 셋은 단위 그대로
    const html = renderToStaticMarkup(
      createElement(HeadlineRow, {
        items: headlines({ rates, lag: 0, bizLag: 0, slowing: false, e2eP50: 2_788.236, e2eRows: 1_200 }),
        dim: false,
      }),
    );
    const card = (key: string) => html.split(`data-key="${key}"`)[1]?.split('data-text')[0] ?? '';
    expect(card('latency')).toContain('>46분 28초</span>');
    expect(card('latency')).not.toContain('text-sm text-slate-500');
    expect(card('sensor')).toContain('<span class="text-sm text-slate-500">개/초</span>');
  });

  it('저장 노드 "지금까지" — 값이 없으면 "약" · "행" 없이 "—"', () => {
    const none = storeLines(rates, null);
    expect(none.ch[2]?.text).toBe('초당 9,681개 · 지금까지 —');
    expect(none.pg[3]?.text).toBe('지금까지 — · —');
  });

  it('노드 · 카드 문구에 코드 · 키 이름이 없다', () => {
    const lines = [
      ...tx(sourceLines(9_681)),
      ...tx(workerLines(rates)),
      ...Object.values(storeLines(rates, null)).flatMap(tx),
      ...whyCards(rates, noFlags).flatMap((c) => [c.why, c.now]),
      ...tx(latestLines(rates, noFlags)),
      ...tx(replyLines(rates, false)),
      ...tx(replyLines(rates, true)),
      pillarFootText(null),
    ];
    for (const t of lines) expect(t).not.toMatch(FORBIDDEN);
    expect(tx(workerLines(rates))).toEqual([
      '모아서 한 번에 저장(배치)',
      '1초에 1.0번',
      '한 번에 약 9,681개',
    ]);
  });

  it('Redis 기둥 칸 — ② 지금 값은 latestWrites · ④ 결과 알림은 업무 요청과 같은 원천(commands) · 바닥은 메모리', () => {
    const r = { ...rates, commands: 2, latestWrites: 9_681 };
    expect(tx(latestLines(r, noFlags))).toEqual([
      '② 지금 값 · 알람 상태',
      '태그마다 가장 최신 값 1개만',
      '초당 9,681개 고침',
    ]);
    expect(latestLines(r, { collectorLatest: true })[2]?.text).toBe('센서 수집기가 직접 고쳐요');
    expect(tx(replyLines(r, false))).toEqual([
      '④ 옛 사본 지움 · 결과 알림',
      '다음 조회가 새 값을 보게',
      '결과 알림 초당 2.0건',
    ]);
    expect(replyLines(r, false)[2]?.text).toBe(`결과 알림 ${bizSrcLines(r)[2]?.text}`);
    expect(replyLines(null, false)[2]?.text).toBe('결과 알림 초당 —건');
    expect(pillarFootText(null)).toBe('Redis 메모리 —');
    expect(whyCards(r, noFlags)[1]?.why).toBe(
      '줄을 세우고 지금 값을 들고 있어요 · 조회도 먼저 여기서 찾아봐요',
    );
  });

  it('모아서 vs 하나씩 — 막대는 처리 시간(대기 단계 빼고 · 단계 합) · 긴 쪽이 1 · 대기는 따로 · 업무가 없으면 ms null(안내 문구)', () => {
    const timeline = [1, 2].map((i) => ({ kind: 'batch' as const, batch: batch(i) }));
    const bars = compareBars(batchStageAverages(timeline), bizStageAverages([biz(1)]), timeline);
    // 센서: 디코드 4 + CH 삽입 64 + 최신값 3 + 알람 6 = 77(스트림 대기 12 뺌) · 업무: 트랜잭션 4.2 + 무효화 1.1 + 결과 0.6 = 5.9(대기 2 뺌)
    expect(bars[0]).toMatchObject({ label: '센서 1묶음(약 1만개)', ms: 77, wait: 12, samples: 2, frac: 1 });
    expect(bars[1]?.ms).toBeCloseTo(5.9);
    expect(bars[1]?.wait).toBe(2);
    expect(bars[1]?.frac).toBeCloseTo(5.9 / 77);
    expect(waitLine(bars)).toBe('대기줄에서 기다린 시간 — 센서 12ms · 업무 2.0ms');
    const none = compareBars(batchStageAverages(timeline), bizStageAverages([]), timeline);
    expect(none[1]).toMatchObject({ ms: null, wait: null, samples: 0 });
    expect(waitLine(none)).toBe('대기줄에서 기다린 시간 — 센서 12ms');
    expect(waitLine(compareBars(batchStageAverages([]), bizStageAverages([]), []))).toBeNull();
    expect(NO_BIZ_TEXT).toContain('오른쪽 위 버튼');
  });

  it('모아서 vs 하나씩 — 대기줄이 밀려도(ClickHouse가 멈춘 뒤 따라잡는 중) 막대는 처리 시간 · 대기는 사람이 읽는 단위 한 줄(리드 L1)', () => {
    const slow = (seq: number) => batch(seq, { stages: { ...batch(seq).stages, streamWaitMs: 2_788_236 } });
    const timeline = [1, 2].map((i) => ({ kind: 'batch' as const, batch: slow(i) }));
    // 대기줄 없이 바로 저장(api-direct)은 대기 단계가 없다 — 업무 대기는 지어내지 않는다
    const direct = biz(1, {
      role: 'api-direct',
      stages: { queueWaitMs: null, txMs: 4.2, invalidateMs: 1.1, replyMs: null },
    });
    const bars = compareBars(batchStageAverages(timeline), bizStageAverages([direct]), timeline);
    expect(bars[0]).toMatchObject({ ms: 77, wait: 2_788_236 });
    expect(bars[1]).toMatchObject({ wait: null, samples: 1 });
    expect(bars[1]?.ms).toBeCloseTo(5.3);
    expect(waitLine(bars)).toBe('대기줄에서 기다린 시간 — 센서 46분 28초');
    expect(durationText(bars[0]?.ms)).toBe('77ms');
  });

  it('사람이 읽는 시간 — 1초 미만 ms · 1분 미만 초(소수 1자리) · 1시간 미만 분 초 · 그 위 시간 분 · 반올림 뒤 단위를 다시 고른다', () => {
    expect(durationText(null)).toBe('—');
    expect(durationText(undefined)).toBe('—');
    expect(durationText(-1)).toBe('—');
    expect(durationText(0)).toBe('0.0ms');
    expect(durationText(7.94)).toBe('7.9ms');
    expect(durationText(9.96)).toBe('10ms');
    expect(durationText(120.4)).toBe('120ms');
    expect(durationText(999.4)).toBe('999ms');
    expect(durationText(999.6)).toBe('1.0초');
    expect(durationText(1_234)).toBe('1.2초');
    expect(durationText(59_940)).toBe('59.9초');
    expect(durationText(59_950)).toBe('1분 0초');
    expect(durationText(2_788_236)).toBe('46분 28초');
    expect(durationText(3_599_400)).toBe('59분 59초');
    expect(durationText(3_599_600)).toBe('1시간 0분');
    expect(durationText(10_920_000)).toBe('3시간 2분');
  });

  it('꺼진 길은 각주에 쉬운 이름으로 · 업무 결과 표지는 쉬운 말', () => {
    expect(offPaths({ ...noFlags, controlCopyOff: true })).toEqual(['PostgreSQL 비교용 사본']);
    expect(footnoteText(['PostgreSQL 비교용 사본'])).toContain('지금 꺼진 길: PostgreSQL 비교용 사본');
    expect(footnoteText([])).not.toContain('꺼진 길');
    expect(footnoteText([])).toContain('조회는 점 없이 숫자로만');
    expect(footnoteText(['PostgreSQL 비교용 사본'])).not.toMatch(FORBIDDEN);
    // 표지는 그린 기호 + 쉬운 말 — 유니코드 기호는 글자로 쓰지 않는다(그리기 검사 test/flow-layout.test.ts)
    expect(markText({ symbol: '✕' })).toBe('거절됨');
    expect(markText({ symbol: '⌛' })).toBe('시간 초과');
    expect(markText({ symbol: '↺' })).toBe('이미 처리됨');
    expect(markText({ symbol: '⚠' })).toBe('저장 못 함');
  });
});
