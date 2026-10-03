'use client';
// EXP-FLOW — 분산 처리 모니터링(/monitoring) · 설계 .omc/plans/web-junior-redesign.md §3(화면 B) · §5 픽셀 예산 · 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW
// 한 화면 한 장(1440 × 900 스크롤 0 · 서랍 0): 제목 · 설명 52 → 숫자 4(60) → 흐름도(남는 높이 — 진행 띠가 생기면 흐름도가 줄어 흡수) → 왜 나눌까 카드 3 · 모아서 vs 하나씩(124) → 회색 각주(24).
// 높이 셈(본문 804 = 900 − 셸 머리 56 − 안쪽 여백 40 · 칸 사이 8): 띠 있음 804 − 52 − 32 − 60 − 124 − 24 − 8 × 5 = 472 · 띠 없음 512 —
//   흐름도 세 줄(viewBox 1132 × 474)이 테두리 · 안쪽 여백 18을 뺀 454 ~ 494 높이에 0.96 ~ 1배로 든다(§9.2 조회 줄 · 숫자 4 84 → 60 · 아래 줄 170 → 124로 흡수).
// 진입이 곧 subscribe_flow이고 이탈이 unsubscribe_flow다 — 셸의 WebSocket 연결 하나를 그대로 쓴다(재연결 재구독은 lib/realtime-socket.ts).
// 관찰 보조 — 기록 정본 아님. flow 프레임은 캐시 층이 없다(Pub/Sub · 링 버퍼 20). 저장소 값은 BFF 흐름 보기 5초 폴링.
// 직접 보내 보기(GEN-12)는 셸 머리 동작 자리(RunControl) · 머리 아래 진행 띠(RunProgress) — 결과는 흐름도가 바로 보여 준다.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../../lib/api';
import {
  applyFlowFrame,
  batchStageAverages,
  bizStageAverages,
  emptyFlowState,
  FLOW_ACK_WAIT_MS,
  FLOW_METRICS_KEY,
  FLOW_METRICS_POLL_MS,
  type FlowMetricRates,
  type FlowMetricsPoll,
  flowMetricRates,
  flowRates,
  flowSubStatus,
  flowSwitchFlags,
  invalidationRate,
  maxBackpressure,
  noSummary,
  plcRawLag,
  readRates,
  serverNow,
  sourcePps,
} from '../../../lib/flow';
import { useShellHealth } from '../../../lib/health';
import { realtimeSocket, useConnectionStore } from '../../../lib/realtime-socket';
import { healthTip } from '../../../lib/switches';
import { formatAge } from '../../../lib/time';
import { useNow } from '../../../lib/use-now';
import { RunProvider } from '../../runs/run-context';
import { RunControl } from '../../runs/run-control';
import { RunProgress } from '../../runs/run-progress';
import { FLOW_PARAM_DEFS } from '../../runs/run-spec';
import { HeaderActions, HeaderStatus } from '../../shell/header-actions';
import { DotEngine, FlowDiagram } from './flow-diagram';
import { BatchVsOne, HeadlineRow, WhyCards } from './flow-panels';
import {
  bizSrcLines,
  bizStreamLines,
  compareBars,
  footnoteText,
  headlines,
  latestLines,
  offPaths,
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
  streamLines,
  whyCards,
  workerLines,
} from './node-lines';

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

export const FLOW_TITLE = '데이터가 Redis를 거쳐 어디로 가는지 실시간으로 보기';
export const FLOW_LEAD =
  '공장 센서 데이터와 업무 데이터가 Redis 대기줄을 거쳐, 각자에게 맞는 DB로 나뉘어 저장되는 모습이에요. 움직이는 점 하나가 실제 데이터 묶음 하나예요.';

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

  const healthQ = useShellHealth({ entry: true });
  const health = healthQ.data?.body ?? null;
  const flags = flowSwitchFlags(state.latestBatch, state.biz[0] ?? null, health?.switches ?? null);
  const sNow = serverNow(state, now);
  const rates = flowRates(state.totals, sNow, { subscribed: sub === 'subscribed' });
  const pps = sourcePps(metricRates);
  const metrics = metricsQ.data?.flow ?? null;

  const skeleton = state.lastFrameAt === null;
  const shown = skeleton ? null : rates;
  const inval = skeleton ? null : invalidationRate(state.biz, state.dropped.biz, sNow);
  const lag = flags.streamOff ? null : plcRawLag(state.latestBatch, metrics?.redis.consumerLag ?? null);
  const bizLag = metrics?.redis.bizStreamLag ?? null;
  const dim = sub === 'disconnected';

  const dataAge = state.lastBatchAt === null ? null : formatAge(sNow - state.lastBatchAt);
  const silent = noSummary(state, sub, now);
  const ackOverdue = sub === 'requesting' && requestedAt !== null && now - requestedAt >= FLOW_ACK_WAIT_MS;
  const notice = dim
    ? `연결이 끊겨 점을 멈췄어요 — 다시 연결되면 이어서 보여 줘요`
    : silent
      ? '10초째 새 데이터가 오지 않아요 — 센서 데이터 적재가 멈췄을 수 있어요'
      : ackOverdue
        ? '연결 확인이 늦어지고 있어요'
        : null;

  const stores = storeLines(shown, metrics);
  // 조회 줄 — 메트릭 5초 차분(첫 폴링 뒤 한 번 더 와야 값이 생긴다) · 원천이 없으면 "—"
  const reads = metricRates ? readRates(metricRates) : null;
  const off = offPaths(flags);

  return (
    <RunProvider type="flow">
      {/* 한 화면 높이 — 본문(100dvh − 셸 머리) − 본문 안쪽 여백 40 */}
      <div
        data-testid="flow-screen"
        className="flex h-[calc(100dvh-var(--header-height)-40px)] min-h-[600px] flex-col gap-2"
      >
        <HeaderStatus>
          <span data-testid="flow-sub" className="text-slate-600">
            · {silent || dataAge === null ? '데이터 기다리는 중' : `마지막 데이터 ${dataAge} 전`}
          </span>
        </HeaderStatus>
        <HeaderActions>
          <RunControl
            params={FLOW_PARAM_DEFS}
            buttonLabel="직접 보내 보기"
            intro="센서 데이터 · 업무 요청 · 조회 요청을 정한 양만큼 보내 봐요 — 결과는 흐름도가 바로 보여 줘요"
          />
        </HeaderActions>

        {/* 제목 · 설명 52 */}
        <header className="h-[52px] shrink-0">
          <h2 className="truncate text-lg leading-7 font-semibold text-slate-900">{FLOW_TITLE}</h2>
          <p className="truncate text-sm leading-6 text-slate-600">{FLOW_LEAD}</p>
        </header>

        {/* 진행 띠 — 직접 보내 보기 중일 때만(32) · 흐름도가 그만큼 줄어든다 */}
        <RunProgress className="shrink-0" />

        <HeadlineRow
          items={headlines({
            rates: shown,
            lag,
            bizLag: flags.bizDirect ? null : bizLag,
            slowing: maxBackpressure(metrics?.redis.backpressure ?? null) !== null,
            e2eP50: metrics?.e2e.p50 ?? null,
            e2eRows: metrics?.e2e.rows ?? null,
          })}
          dim={dim}
        />

        {/* 흐름도 — 남는 높이(1440 × 900 · 띠 있음 472 · 없음 512) */}
        <section
          aria-label="흐름도"
          className="relative min-h-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          {notice ? (
            <p
              data-testid="flow-notice"
              className="absolute top-2 right-3 rounded-full border border-amber-200 bg-amber-50 px-3 py-0.5 text-xs text-amber-800"
            >
              {notice}
            </p>
          ) : null}
          <FlowDiagram
            engine={engine}
            rates={rates}
            flags={flags}
            lines={{
              src: sourceLines(skeleton ? null : rates.rows),
              stream: streamLines(skeleton ? null : lag, flags.streamOff),
              latest: latestLines(shown, flags),
              bizStream: bizStreamLines(bizLag, flags.bizDirect),
              reply: replyLines(shown, flags.bizDirect),
              worker: workerLines(shown),
              bizSrc: bizSrcLines(shown),
              ch: stores.ch,
              pg: stores.pg,
              readSrc: readSrcLines(reads),
              readCache: readCacheLines(reads),
            }}
            reads={reads}
            readMissLabel={readMissLabel(reads)}
            readSrcTip={readSrcTip(reads)}
            readCacheTip={readCacheTip(reads)}
            pillarFoot={pillarFootText(metrics)}
            sourceTip={skeleton ? null : sourceTip(pps, metricRates)}
            invalidation={inval?.value ?? null}
            skeleton={skeleton}
          />
        </section>

        {/* 아래 줄 124 — 왜 나눌까 카드 3 · 모아서 vs 하나씩 */}
        <div className="grid h-[124px] shrink-0 grid-cols-[2fr_1fr] gap-3">
          <WhyCards cards={whyCards(shown, flags)} dim={dim} />
          <BatchVsOne
            bars={compareBars(
              batchStageAverages(state.timeline),
              bizStageAverages(state.biz),
              state.timeline,
            )}
            dim={dim}
          />
        </div>

        {/* 회색 각주 24 — 마우스를 올리면 스위치 · 저장소 상태(health) */}
        <p
          data-testid="flow-footnote"
          className="h-6 shrink-0 truncate text-xs leading-6 text-slate-500"
          title={healthTip(health, healthQ.isError && !health)}
        >
          {footnoteText(off)}
        </p>
      </div>
    </RunProvider>
  );
}
