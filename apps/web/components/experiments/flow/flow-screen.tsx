'use client';
// ⑥ 분산 처리 모니터링(/monitoring · EXP-FLOW) — 정본 docs/08_screen/08_evidence_screens.md §EXP-FLOW · docs/08_screen/01_standards.md §반응형 규칙
// 화면 틀(components/shell/screen.tsx Screen): 제목 · 설명 + 머리 오른쪽 설비 가동 스위치 · 데이터 지우기 → 진행 띠(직접 보내 보기 중) → 숫자 4(64 → 88) →
// 흐름도(남는 높이 — viewBox 1126 × 440 · meet) → 왜 나눌까 · 모아서 vs 하나씩(124 → 160) → 회색 각주(Footnote · 세부는 ⓘ 툴팁 — 스위치 · 저장소 상태).
// 숫자 4 · 아래 줄의 높이와 글자는 1280 기준값에서 2560까지 글자 토큰(app/globals.css --fs)과 같은 비율로 는다.
// 맞춤 보기(1280×720 ~ 2560×1440)는 페이지 스크롤 0 — 세로가 820px 미만이면 아래 줄(124)을 빼서 흐름도가 배율 1(글자 12px 이상)을 지킨다.
// 작은 화면(맞춤 보기 밖)은 흐름도가 원래 비율로 쌓이고 본문만 세로로 스크롤한다.
// 진입이 곧 subscribe_flow이고 이탈이 unsubscribe_flow다 — 셸의 WebSocket 연결 하나를 그대로 쓴다(재연결 재구독은 lib/realtime-socket.ts).
// 관찰 보조 — 기록 정본 아님. flow 프레임은 캐시 층이 없다(Pub/Sub · 링 버퍼 20). 저장소 값은 BFF 흐름 보기 5초 폴링.
// 직접 보내 보기(GEN-12)는 셸 머리 동작 자리(RunControl) · 진행 띠(RunProgress) — 결과는 흐름도가 바로 보여 준다.
// 센서가 안 올 때의 안내는 설비 가동 기준(health run.sensorAutogen — 실행 중 실효 상태 · 설비 가동 스위치가 정한다).
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
  type FlowNoticeInput,
  flowMetricRates,
  flowNotice,
  flowRates,
  flowSubStatus,
  flowSwitchFlags,
  invalidationRate,
  maxBackpressure,
  noSummary,
  plcRawLag,
  readRates,
  sensorQuiet,
  serverNow,
  sourcePps,
} from '../../../lib/flow';
import { useShellHealth } from '../../../lib/health';
import { realtimeSocket, useConnectionStore } from '../../../lib/realtime-socket';
import { isActive, panelRun } from '../../../lib/runs';
import { healthTip } from '../../../lib/switches';
import { formatAge } from '../../../lib/time';
import { useNow } from '../../../lib/use-now';
import { cn } from '../../../lib/utils';
import { PlantPowerSwitch } from '../../controls/plant-power';
import { PurgeButton } from '../../controls/purge-button';
import { RunProvider, useRunContext } from '../../runs/run-context';
import { RunControl } from '../../runs/run-control';
import { RunProgress } from '../../runs/run-progress';
import { FLOW_PARAM_DEFS } from '../../runs/run-spec';
import { HeaderActions, HeaderStatus } from '../../shell/header-actions';
import { Footnote, Screen } from '../../shell/screen';
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
  '공장 센서 데이터와 업무 데이터가 Redis 대기줄을 거쳐, 각자에게 맞는 DB로 나뉘어 저장되는 모습이에요. 움직이는 점 하나가 실제 묶음 · 요청 하나예요(조회 점은 실제 비율대로).';

/**
 * 흐름도 알림 한 줄 — 직접 보내 보기 실행 상태(running · stopping이면 꺼짐 안내를 숨긴다)가 필요해 RunProvider 안에서 그린다
 * (current 1초 폴링은 Provider 한 곳 — run-context). 자리는 흐름도 오른쪽 아래 빈 모서리 — 위에 두면 단 머리("어디에 저장하나")를 덮는다.
 */
function FlowNoticeLine({ input }: { input: Omit<FlowNoticeInput, 'flowRunActive'> }) {
  const { snapshot, type } = useRunContext();
  const run = panelRun(snapshot, type);
  const notice = flowNotice({ ...input, flowRunActive: run !== null && isActive(run.status) });
  if (!notice) return null;
  return (
    <p
      data-testid="flow-notice"
      data-tone={notice.tone}
      className={cn(
        'absolute right-3 bottom-2 rounded-full border px-3 py-0.5 text-foot',
        notice.tone === 'info'
          ? 'border-slate-200 bg-slate-50 text-slate-600'
          : 'border-amber-200 bg-amber-50 text-amber-800',
      )}
    >
      {notice.text}
    </p>
  );
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
  // 센서 자동 생성이 꺼져 있으면(health run.sensorAutogen off) 센서가 안 오는 것이 정상 — 경고 대신 차분한 안내(실행 상태는 FlowNoticeLine이 더한다)
  const noticeInput = {
    sub,
    silent,
    ackOverdue,
    sensorQuiet: sensorQuiet(state, sub, sNow),
    sensorAutogen: health?.run.sensorAutogen ?? null,
  };

  const stores = storeLines(shown, metrics);
  // 조회 줄 — 메트릭 5초 차분(첫 폴링 뒤 한 번 더 와야 값이 생긴다) · 원천이 없으면 "—"
  const reads = metricRates ? readRates(metricRates) : null;
  const off = offPaths(flags);

  return (
    <RunProvider type="flow">
      {/* data-testid는 e2e가 화면 뿌리를 찾는 이름(display contents — 화면 틀이 셸 본문 높이를 그대로 받는다) */}
      <div data-testid="flow-screen" className="contents">
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
        <Screen
          id="monitoring"
          title={FLOW_TITLE}
          lead={FLOW_LEAD}
          aside={
            <>
              <PlantPowerSwitch />
              <PurgeButton />
            </>
          }
          foot={
            <Footnote testId="flow-footnote" tip={healthTip(health, healthQ.isError && !health)}>
              {footnoteText(off, flags.controlCopyOff && flags.controlCopyGated)}
            </Footnote>
          }
        >
          {/* 진행 띠 — 직접 보내 보기 중일 때만 · 흐름도가 그만큼 줄어든다 */}
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

          {/* 흐름도 — 남는 높이를 다 가진다(viewBox 1126 × 440 · meet) · 작은 화면은 원래 비율로 쌓인다 */}
          <section
            aria-label="흐름도"
            className="relative aspect-[1150/454] w-full shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 fit:aspect-auto fit:min-h-0 fit:flex-1 fit:shrink"
          >
            <FlowNoticeLine input={noticeInput} />
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

          {/* 아래 줄 124(1280) → 160(2560 — 글자 토큰과 같은 비율) — 왜 나눌까(한 구역 세 칸) · 모아서 vs 하나씩. 맞춤 보기에서 세로가 짧으면(820px 미만) 줄을 뺀다 —
              흐름도 글자(viewBox 12 ~ 14)가 배율 1 아래로 줄지 않게(반응형 규칙 "줄 수를 줄인다") */}
          <div className="grid h-[clamp(124px,calc(124px+36*var(--fs)),160px)] shrink-0 grid-cols-[2fr_1fr] gap-[var(--gap)] [@media(min-width:80rem)_and_(min-height:45rem)_and_(max-height:51.2rem)]:hidden">
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
        </Screen>
      </div>
    </RunProvider>
  );
}
