'use client';
// DSH-REALTIME — 정본 docs/08_screen/03_realtime_dashboard.md (S2 최소 1페이지: 최신값 표 + uPlot 트렌드 1)
// 진입 순서: WebSocket 연결 → subscribe → REST 최신값 1회 → 트렌드 과거 채움 1회. 이후 값은 rt 프레임으로만 받는다(폴링 없음).
// WebSocket이 재연결하지 않는 종료(4403 · 4400 등 — 끊김)로 멈춰 있으면 구독할 연결이 없으므로 진입 · 설비 전환마다 REST 1회만 부른다 — 표가 스켈레톤에 갇히지 않게.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { directUrl, requestJson, retryOn503 } from '../../lib/api';
import { TIMESERIES_GC_MS, TREND_MAX_TAGS, TREND_WINDOW_MS } from '../../lib/config';
import { errorCode, errorText } from '../../lib/error-display';
import { closedBandText, createLatestReadGate, headerCounts } from '../../lib/latest';
import { writeLastDevice } from '../../lib/realtime-nav';
import { realtimeSocket, useConnectionStore } from '../../lib/realtime-socket';
import { useRealtimeStore } from '../../lib/realtime-store';
import { LatestDeviceResponse, TimeseriesQueryResponse, WS_CLOSE } from '../../lib/shared';
import { dashboardConfigBadges } from '../../lib/switches';
import { toKstOffsetIso } from '../../lib/time';
import { useNow } from '../../lib/use-now';
import { useShellHealth } from '../shell/experiment-badge';
import { Badge } from '../ui/badge';
import { Band } from '../ui/band';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { AlarmBand } from './alarm-band';
import { DevicePicker } from './device-picker';
import { LatestTable } from './latest-table';
import { TrendChart } from './trend-chart';

export function RealtimeDashboard({ deviceId, focusTagId }: { deviceId: number; focusTagId?: number }) {
  const syncEpoch = useConnectionStore((s) => s.syncEpoch);
  const metaEpoch = useConnectionStore((s) => s.metaEpoch);
  const lastCloseCode = useConnectionStore((s) => s.lastCloseCode);
  const wsStatus = useConnectionStore((s) => s.status);
  const order = useRealtimeStore((s) => s.order);
  const meta = useRealtimeStore((s) => s.meta);
  // 호출 판정 — 쿼리 캐시(isFetched)가 아니라 이 진입의 호출 여부로 가른다(lib/latest createLatestReadGate)
  const gate = useRef(createLatestReadGate()).current;

  // 구독 교체 — 이전 설비 해지 · 새 설비 구독(08_screen/03 §갱신과 값 병합)
  useEffect(() => {
    gate.enter(deviceId);
    useRealtimeStore.getState().resetDevice(deviceId);
    writeLastDevice(deviceId);
    realtimeSocket.subscribe(deviceId);
    return () => realtimeSocket.unsubscribe(deviceId);
  }, [deviceId, gate]);

  // 최신값 — staleTime 0 · 주기 재조회 없음. 진입 · 설비 전환 · 재연결(syncEpoch) 세 사건에만 부른다
  const latestQ = useQuery({
    queryKey: ['realtime', 'device', deviceId],
    queryFn: async () => {
      const r = await requestJson(directUrl(`/api/v1/realtime/devices/${deviceId}/tags`));
      const body = LatestDeviceResponse.parse(r.body);
      useRealtimeStore.getState().applyRest(body, r.receivedAt);
      return { itemCount: body.items.length, source: body.meta.source, restored: body.meta.restored };
    },
    enabled: false,
    staleTime: 0,
    retry: retryOn503,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const refetchLatest = latestQ.refetch;
  // biome-ignore lint/correctness/useExhaustiveDependencies: syncEpoch 증가(연결 · 구독 완료) · metaEpoch 증가(태그 메타 신호)가 호출 사건이다
  useEffect(() => {
    if (gate.onSync(useConnectionStore.getState().status)) void refetchLatest();
  }, [deviceId, syncEpoch, metaEpoch, refetchLatest, gate]);
  // 끊김(재연결하지 않는 종료) — 진입 · 설비 전환마다 REST 1회. 재연결 중(백오프)은 연결 뒤 syncEpoch가 부른다.
  // 열린 뒤 응답 전에 끊겨도 이 진입의 호출은 이미 나갔으므로 다시 부르지 않는다
  // biome-ignore lint/correctness/useExhaustiveDependencies: 설비 · 끊김 전이가 호출 사건이다
  useEffect(() => {
    if (gate.onStatus(wsStatus)) void refetchLatest();
  }, [deviceId, wsStatus, refetchLatest, gate]);

  // 트렌드 태그 — 표에서 고른 태그 최대 8 · 기본은 앞 8개 · 태그 딥링크 진입이면 그 태그 하나
  const [picked, setPicked] = useState<number[] | null>(focusTagId === undefined ? null : [focusTagId]);
  const selectedKey = (picked ?? order.slice(0, TREND_MAX_TAGS)).join(',');
  const selected = useMemo(
    () => (selectedKey === '' ? [] : selectedKey.split(',').map(Number)),
    [selectedKey],
  );
  const toggle = (tagId: number) => {
    const cur = picked ?? order.slice(0, TREND_MAX_TAGS);
    setPicked(
      cur.includes(tagId) ? cur.filter((t) => t !== tagId) : [...cur, tagId].slice(0, TREND_MAX_TAGS),
    );
  };

  // 과거 채움 — REST 첫 성공 뒤 1회 · 트렌드 태그 추가 때 새 태그만. 주기적으로 다시 채우지 않는다
  const filled = useRef(new Set<number>());
  const [fill, setFill] = useState<{ tagIds: number[]; to: number } | null>(null);
  useEffect(() => {
    if (!latestQ.isSuccess) return;
    const missing = selected.filter((t) => !filled.current.has(t));
    if (missing.length === 0) return;
    for (const t of missing) filled.current.add(t);
    setFill({ tagIds: missing, to: Date.now() });
  }, [latestQ.isSuccess, selected]);

  const historyQ = useQuery({
    queryKey: [
      'timeseries',
      { tagIds: fill?.tagIds ?? [], to: fill?.to ?? 0, windowMs: TREND_WINDOW_MS, interval: 'raw' },
    ],
    queryFn: async () => {
      if (!fill) return null;
      const r = await requestJson(directUrl('/api/v1/timeseries/query'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tagIds: fill.tagIds,
          from: toKstOffsetIso(fill.to - TREND_WINDOW_MS),
          to: toKstOffsetIso(fill.to),
          interval: 'raw',
        }),
      });
      const body = TimeseriesQueryResponse.parse(r.body);
      useRealtimeStore.getState().applyHistory(deviceId, body);
      return {
        interval: body.meta.interval,
        pointCount: body.meta.pointCount,
        downsampled: body.meta.downsampled,
      };
    },
    enabled: fill !== null,
    staleTime: 0, // 시계열 최근 구간 — 서버가 캐시하지 않는다
    gcTime: TIMESERIES_GC_MS,
    retry: retryOn503,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // 시계열 응답의 tagName은 S2에서 null(Dictionary가 S3) — 이름은 최신값 응답에서 가져온다
  const labels = useMemo(() => {
    const out: Record<number, string> = {};
    for (const id of selected) out[id] = meta[id]?.tagName ?? `tag ${id}`;
    return out;
  }, [selected, meta]);

  const latestErr = latestQ.error;
  const latestCode = errorCode(latestErr);
  const upstreamDown =
    latestCode === 'realtime.latest_unavailable' || lastCloseCode === WS_CLOSE.upstream_unavailable;
  const loading = !latestQ.isSuccess && !latestQ.isError;
  const health = useShellHealth().data?.body;
  const badges = health ? dashboardConfigBadges(health.switches) : [];
  const empty = latestQ.isSuccess && latestQ.data.itemCount === 0 && order.length === 0;
  const closedText = closedBandText(wsStatus, lastCloseCode, latestQ.isSuccess && !latestQ.isFetching);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <DevicePicker deviceId={deviceId} />
            <HeaderCounts />
            {badges.map((b) => (
              <Badge
                key={b.id}
                variant="warning"
                title={`${b.id} 기본값 아님 — 실험 콘솔에서 주입 구현 확인`}
              >
                구성 배지: {b.text}
              </Badge>
            ))}
          </div>
          <CardTitle>설비 {deviceId} 최신값</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {upstreamDown && (
            <Band>
              실시간 저장소 응답 불가
              {latestCode ? ` (${latestCode}/503)` : ` (WS ${WS_CLOSE.upstream_unavailable})`} — 마지막 값을
              흐리게 유지한다 · 백오프 뒤 재조회
            </Band>
          )}
          {latestErr !== null && !upstreamDown && <Band>{errorText(latestErr)}</Band>}
          {!latestQ.isFetched && wsStatus !== 'open' && wsStatus !== 'closed' && (
            <Band tone="info">WebSocket 연결 · 구독 뒤 최신값을 읽는다</Band>
          )}
          {closedText !== null && <Band tone="warning">{closedText}</Band>}
          {empty ? (
            <p className="py-6 text-center text-sm text-slate-500">이 설비는 아직 측정값이 없다</p>
          ) : (
            <LatestTable
              loading={loading}
              dimmed={upstreamDown}
              selected={selected}
              maxSelected={TREND_MAX_TAGS}
              onToggle={toggle}
            />
          )}
        </CardContent>
        {latestQ.isSuccess && latestQ.data.source !== 'redis' && (
          <CardFooter>
            원천 {latestQ.data.source}
            {latestQ.data.source === 'restored' ? ' — 방금 ClickHouse에서 복원' : ''}
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>실시간 트렌드 — 최근 5분 · 최대 {TREND_MAX_TAGS}태그</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {historyQ.error !== null && <Band>{errorText(historyQ.error)} — 이미 그린 점은 유지한다</Band>}
          {selected.length === 0 && !loading && (
            <p className="text-sm text-slate-500">표에서 태그를 고른다</p>
          )}
          <TrendChart tagIds={selected} labels={labels} />
        </CardContent>
        {historyQ.data && (
          <CardFooter>
            과거 채움 해상도 {historyQ.data.interval} · {historyQ.data.pointCount}점
            {historyQ.data.downsampled ? ' · 서버 다운샘플' : ''}
          </CardFooter>
        )}
      </Card>

      <AlarmBand
        tagsKnown={latestQ.isSuccess || order.length > 0}
        // 첫 진입의 idle · connecting은 끊김이 아니다 — 08_screen/03 §장애 표의 끊김은 끊긴 뒤 상태(재연결 중 · 닫힘 · 저장소 503)
        down={wsStatus === 'reconnecting' || wsStatus === 'closed' || upstreamDown}
      />
    </div>
  );
}

/** 머리 숫자 — STALE n/N(서버 · 화면 판정의 합집합 · 표와 같은 판정식) · 통신 이상 m */
function HeaderCounts() {
  const order = useRealtimeStore((s) => s.order);
  const latest = useRealtimeStore((s) => s.latest);
  const meta = useRealtimeStore((s) => s.meta);
  const offsetMs = useRealtimeStore((s) => s.offsetMs);
  const now = useNow(1000);
  const tags = order.flatMap((id) => {
    const tag = latest[id];
    return tag ? [{ tag, staleAfterMs: meta[id]?.staleAfterMs ?? null }] : [];
  });
  if (tags.length === 0) return null;
  const c = headerCounts(tags, now, offsetMs);
  return (
    <span className="text-xs tabular-nums text-slate-600" data-panel="header-counts">
      <span className={c.stale > 0 ? 'font-medium text-amber-700' : ''}>
        STALE {c.stale}/{c.total}
      </span>
      {' · '}
      <span className={c.bad > 0 ? 'font-medium text-red-700' : ''}>통신 이상 {c.bad}</span>
    </span>
  );
}
