'use client';
// EXP-FLOW — 분산 처리 모니터링 · 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW
// 진입이 곧 subscribe_flow이고 이탈이 unsubscribe_flow다 — 셸의 WebSocket 연결 하나를 그대로 쓴다(재연결 재구독은 lib/realtime-socket.ts).
// 관찰 보조 — 기록 정본 아님. flow 프레임은 캐시 층이 없다(Pub/Sub · 링 버퍼 20). 저장소 누적은 BFF 흐름 보기 5초 폴링.
// 실행 패널(GEN-12)은 머리 아래 — flow 실행 중에는 흐름도 머리에 "라이브 flow 실행 중 — pps N · 업무 N/초"(표시 계약 실행 발행 원천).
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import {
  applyFlowFrame,
  emptyFlowState,
  FLOW_ACK_WAIT_MS,
  FLOW_METRICS_KEY,
  FLOW_METRICS_POLL_MS,
  type FlowMetricRates,
  type FlowMetricsPoll,
  type FlowSubStatus,
  flowMetricRates,
  flowRates,
  flowSubStatus,
  flowSwitchFlags,
  formatScale,
  noSummary,
  serverNow,
  sourcePps,
} from '../../../lib/flow';
import { realtimeSocket, useConnectionStore } from '../../../lib/realtime-socket';
import { isActive, panelRun } from '../../../lib/runs';
import { formatAge } from '../../../lib/time';
import { useNow } from '../../../lib/use-now';
import { cn } from '../../../lib/utils';
import { FlowProgressBar, FlowResultTable } from '../../runs/flow-run';
import { RunPanel } from '../../runs/run-panel';
import { useCurrentRun } from '../../runs/use-run';
import { useShellHealth } from '../../shell/experiment-badge';
import { Band } from '../../ui/band';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { BatchTimeline } from './batch-timeline';
import { BizList } from './biz-list';
import { DotEngine, FlowDiagram } from './flow-diagram';
import { StoreCards } from './store-cards';

async function fetchFlowMetrics(): Promise<FlowMetricsPoll> {
  let res: Response;
  try {
    res = await fetch('/bff/metrics?view=flow', { cache: 'no-store' });
  } catch {
    throw new ApiError(0, null, 'BFF에 닿지 못했다');
  }
  if (!res.ok) throw new ApiError(res.status, null, `HTTP ${res.status}`);
  return (await res.json()) as FlowMetricsPoll;
}

const SUB_LABEL: Record<FlowSubStatus, string> = {
  subscribed: '구독 중',
  requesting: '구독 요청 중',
  disconnected: '끊김',
};
const SUB_DOT: Record<FlowSubStatus, string> = {
  subscribed: 'bg-emerald-500',
  requesting: 'bg-amber-400',
  disconnected: 'bg-red-500',
};

function perSec(v: number | null): string {
  if (v === null) return '—';
  return v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(1);
}

export function FlowScreen() {
  const conn = useConnectionStore((s) => s.status);
  const flowSub = useConnectionStore((s) => s.flow);
  const sub = flowSubStatus(conn, flowSub);

  const stateRef = useRef(emptyFlowState());
  const [state, setState] = useState(stateRef.current);
  const [engine] = useState(() => new DotEngine());

  // 진입 subscribe_flow · 이탈 unsubscribe_flow — 재연결 뒤 재전송은 소켓 래퍼가 한다
  useEffect(() => {
    const off = realtimeSocket.onFlow((frame, receivedAt) => {
      const r = applyFlowFrame(stateRef.current, frame, receivedAt);
      stateRef.current = r.state;
      setState(r.state);
      if (r.added.batches.length > 0) engine.addBatches(r.added.batches);
      if (r.added.biz.length > 0) engine.addBiz(r.added.biz);
    });
    realtimeSocket.subscribeFlow();
    return () => {
      off();
      realtimeSocket.unsubscribeFlow();
    };
  }, [engine]);

  // 셸 WS가 끊기면 점 애니메이션을 멈춘다(표시 계약 구독 없음 · 끊김)
  useEffect(() => {
    engine.paused = conn !== 'open';
  }, [engine, conn]);

  // 구독 요청이 확인 프레임 없이 오래 가면 빈 값 ③(흐름 이벤트 미도입 단계)
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  useEffect(() => {
    setRequestedAt(sub === 'requesting' ? Date.now() : null);
  }, [sub]);

  const now = useNow(1_000);

  const metricsQ = useQuery({
    queryKey: FLOW_METRICS_KEY,
    queryFn: fetchFlowMetrics,
    staleTime: 0,
    refetchInterval: FLOW_METRICS_POLL_MS,
    retry: false,
  });
  // 초당 값은 두 응답의 차로 — 재기동(누적 감소)은 그 값만 비운다
  const prevPoll = useRef<FlowMetricsPoll | null>(null);
  const [metricRates, setMetricRates] = useState<FlowMetricRates | null>(null);
  useEffect(() => {
    const d = metricsQ.data;
    if (!d || prevPoll.current?.fetchedAt === d.fetchedAt) return;
    setMetricRates(flowMetricRates(prevPoll.current, d));
    prevPoll.current = d;
  }, [metricsQ.data]);

  const health = useShellHealth().data?.body ?? null;
  const flags = flowSwitchFlags(state.latestBatch, state.biz[0] ?? null, health?.switches ?? null);
  const sNow = serverNow(state, now);
  const rates = flowRates(state.totals, sNow);
  const pps = sourcePps(metricRates);
  const metrics = metricsQ.data?.flow ?? null;

  const batchAge = state.lastBatchAt === null ? null : formatAge(sNow - state.lastBatchAt);
  const silent = noSummary(state, sub, now);
  const ackOverdue = sub === 'requesting' && requestedAt !== null && now - requestedAt >= FLOW_ACK_WAIT_MS;
  const hasBatch = state.timeline.some((e) => e.kind === 'batch');
  const skeleton = state.lastFrameAt === null;
  const flowRun = panelRun(useCurrentRun().data, 'flow');
  const liveFlow = flowRun && isActive(flowRun.status) ? flowRun.params : null;

  return (
    <div className="flex flex-col gap-4">
      {/* 머리 — 흐름 구독 표지(화면 제목 h1은 셸 콘텐츠 머리가 낸다) */}
      <div
        data-flow="header"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
      >
        <span className="flex items-center gap-2 font-medium">
          <span className={cn('inline-block h-2.5 w-2.5 rounded-full', SUB_DOT[sub])} />
          흐름 구독 {SUB_LABEL[sub]}
        </span>
        <span className="text-slate-600">
          {sub === 'disconnected' ? '끊김 — ' : ''}
          마지막 배치 {batchAge === null ? '없음' : `${batchAge} 전`}
        </span>
        <span className="tabular-nums text-slate-600">배치 {perSec(rates.batches)}/초</span>
        <span className="tabular-nums text-slate-600">업무 명령 {perSec(rates.commands)}/초</span>
        <span
          className="text-slate-600"
          title="단계 ms에 한 배율을 곱한다 — 배치 전체가 1.5초보다 짧으면 늘리고 비율은 유지"
        >
          배치 점 {engine.lastBatchScale === null ? '—' : formatScale(engine.lastBatchScale)} · 업무 점{' '}
          {engine.lastBizScale === null ? '—' : formatScale(engine.lastBizScale)}
        </span>
        {state.skipped > 0 && (
          <span className="text-slate-600">병합 생략 {state.skipped.toLocaleString('ko-KR')}배치</span>
        )}
        {state.dropped.batches + state.dropped.biz > 0 && (
          <span
            className="text-slate-600"
            title="게이트웨이 병합 창(250 ms) 상한을 넘어 버린 요약 — 합계는 totals에서 계산"
          >
            창 상한 버림 배치 {state.dropped.batches} · 업무 {state.dropped.biz}
          </span>
        )}
        <span className="ml-auto rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
          관찰 보조 — 기록 정본 아님
        </span>
      </div>

      <RunPanel
        type="flow"
        progress={(run, receivedAt, at) => <FlowProgressBar run={run} receivedAt={receivedAt} now={at} />}
        result={(run) => <FlowResultTable run={run} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>흐름도 — 점 하나가 요약 하나 · 머묾 비율이 실제 단계 ms 비율</CardTitle>
          {liveFlow ? (
            <p data-testid="flow-live-run" className="text-xs font-medium text-sky-800">
              라이브 flow 실행 중 — pps {(liveFlow.pps ?? 0).toLocaleString('ko-KR')} · 업무{' '}
              {liveFlow.bizPerSec ?? 0}/초
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sub === 'disconnected' && (
            <Band tone="warning">
              끊김 — 마지막 배치 {batchAge === null ? '없음' : `${batchAge} 전`} · 점 애니메이션을 멈췄다 ·
              재연결 뒤 다시 구독한다(끊긴 동안의 요약은 오지 않는다)
            </Band>
          )}
          {ackOverdue && (
            <Band tone="info">
              이 단계에서 아직 흐름 이벤트를 발행하지 않는다 — 구독 확인 프레임이 {FLOW_ACK_WAIT_MS / 1000}초
              동안 오지 않았다
            </Band>
          )}
          {silent && (
            <Band tone="warning">
              배치 요약 없음 — 적재가 멈췄거나 발행이 꺼져 있다(표지 cache:flow:subscribed를 읽지 못한
              발행자는 발행하지 않는다) · 컨슈머 랙{' '}
              {metrics?.redis.consumerLag?.toLocaleString('ko-KR') ?? '—'} · 발생원{' '}
              {pps === null ? '—' : `${perSec(pps)} 점/초`}
            </Band>
          )}
          <FlowDiagram
            engine={engine}
            rates={rates}
            flags={flags}
            sourcePps={pps}
            stream={state.latestBatch?.stream ?? null}
            bizLag={metrics?.redis.bizStreamLag ?? null}
            skeleton={skeleton}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>배치 타임라인 — 최근 20배치 · 단계 막대 · 병합 생략 표지</CardTitle>
        </CardHeader>
        <CardContent>
          {sub === 'subscribed' && !hasBatch && (
            <p className="mb-2 text-sm text-slate-500">
              배치 요약이 아직 없다 — 발생원이 발행 중인지 메트릭 초당 포인트로 확인(발생원{' '}
              {pps === null ? '—' : `${perSec(pps)} 점/초`})
            </p>
          )}
          <BatchTimeline entries={state.timeline} />
        </CardContent>
      </Card>

      <StoreCards
        metrics={metrics}
        rates={metricRates}
        fetchedAt={metricsQ.data?.fetchedAt ?? null}
        failed={metricsQ.isError}
        lastSuccessAt={metricsQ.dataUpdatedAt}
        now={now}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            업무 명령 — 최근 20건{flags.bizDirect ? ' · SW-12 direct — 옛 경로(비교 실험용)' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BizList items={state.biz} />
        </CardContent>
      </Card>

      <p className="text-xs text-slate-500">
        관찰 보조 — 기록 정본 아님 · 구독 중에는 워커(SW-12 direct면 api)가 요약을 발행한다(측정 중 닫는다)
      </p>
    </div>
  );
}
