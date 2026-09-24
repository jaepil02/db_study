'use client';
// EXP-CONSOLE — 정본 docs/08_screen/07_experiment_console.md (S2분: 저장소 상태 · 스위치 표 · 조합 경고 · 메트릭 카드 3계열 ·
// 기록 조건 블록 · 정밀 측정 모드). 표시 전용 — 스위치를 바꾸는 손잡이가 없다.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { CONSOLE_POLL_MS } from '../../lib/config';
import { type MetricsSummary, ratePerSecond } from '../../lib/metrics-parser';
import { HealthResponse } from '../../lib/shared';
import { buildSwitchRows, comboWarnings, countNonDefault } from '../../lib/switches';
import { formatKst, formatKstIso } from '../../lib/time';
import { Badge } from '../ui/badge';
import { Band } from '../ui/band';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { MetricCards } from './metric-cards';
import { RecordBlock } from './record-block';
import { StoreStatus } from './store-status';
import { SwitchTable } from './switch-table';

async function fetchHealth() {
  let res: Response;
  try {
    res = await fetch('/bff/health', { cache: 'no-store' });
  } catch {
    throw new ApiError(0, null, 'BFF에 닿지 못했다');
  }
  // 200 · 503 모두 같은 본문 — 503은 오류가 아니라 저장소별 상태로 그린다(REQ-OBS-09)
  if (res.status !== 200 && res.status !== 503) throw new ApiError(res.status, null, `HTTP ${res.status}`);
  return { httpStatus: res.status, body: HealthResponse.parse(await res.json()) };
}

async function fetchMetrics(): Promise<{ fetchedAt: number; summary: MetricsSummary }> {
  let res: Response;
  try {
    res = await fetch('/bff/metrics', { cache: 'no-store' });
  } catch {
    throw new ApiError(0, null, 'BFF에 닿지 못했다');
  }
  if (!res.ok) throw new ApiError(res.status, null, `HTTP ${res.status}`);
  return (await res.json()) as { fetchedAt: number; summary: MetricsSummary };
}

export function ExperimentConsole() {
  // 정밀 측정 모드 — 켜면 이 화면의 모든 폴링을 멈춘다(브라우저 안 설정)
  const [precise, setPrecise] = useState(false);

  const healthQ = useQuery({
    queryKey: ['obs', 'health'],
    queryFn: fetchHealth,
    staleTime: 0,
    enabled: !precise,
    refetchInterval: precise ? false : CONSOLE_POLL_MS,
    retry: false,
  });
  const metricsQ = useQuery({
    queryKey: ['obs', 'metrics'],
    queryFn: fetchMetrics,
    staleTime: 0,
    enabled: !precise,
    refetchInterval: precise ? false : CONSOLE_POLL_MS,
    retry: false,
  });

  // 생성기 pps — 두 폴링 사이 누적값 차(모드 A)
  const prevGen = useRef<{ value: number | null; atMs: number } | null>(null);
  const [genPps, setGenPps] = useState<number | null>(null);
  useEffect(() => {
    const d = metricsQ.data;
    if (!d) return;
    const cur = { value: d.summary.genPointsModeA, atMs: d.fetchedAt };
    if (prevGen.current?.atMs === cur.atMs) return;
    setGenPps(ratePerSecond(prevGen.current, cur));
    prevGen.current = cur;
  }, [metricsQ.data]);

  const health = healthQ.data?.body;
  const rows = health ? buildSwitchRows(health.switches) : null;
  const warnings = health ? comboWarnings(health.switches) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">실험 콘솔</h1>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={precise} onChange={(e) => setPrecise(e.target.checked)} />
          정밀 측정 모드 — 폴링 정지
          {precise ? <Badge variant="warning">관찰 정지</Badge> : <Badge variant="outline">15초 폴링</Badge>}
        </label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>저장소</CardTitle>
        </CardHeader>
        <CardContent>
          {healthQ.isError && (
            <Band>
              health를 읽지 못했다
              {healthQ.dataUpdatedAt > 0 && ` — 마지막 성공 ${formatKst(healthQ.dataUpdatedAt, true)}`}
            </Band>
          )}
          {health ? (
            <StoreStatus
              health={health}
              httpStatus={healthQ.data?.httpStatus ?? 0}
              fetchedAt={healthQ.dataUpdatedAt}
            />
          ) : (
            !healthQ.isError && <div className="h-6 animate-pulse rounded bg-slate-100" />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>스위치 {rows ? `— 기본값과 다른 스위치 ${countNonDefault(rows)}` : ''}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rows ? <SwitchTable rows={rows} /> : <div className="h-40 animate-pulse rounded bg-slate-100" />}
          {warnings.map((w) => (
            <Band key={w.no} tone="warning">
              ⚠ 조합 제약 #{w.no} — {w.text}
            </Band>
          ))}
        </CardContent>
      </Card>

      <MetricCards
        summary={metricsQ.data?.summary ?? null}
        fetchedAt={metricsQ.data?.fetchedAt ?? null}
        genPps={genPps}
        failed={metricsQ.isError}
        lastSuccessAt={metricsQ.dataUpdatedAt}
      />

      {health && (
        <Card>
          <CardHeader>
            <CardTitle>기록 조건 블록</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordBlock health={health} />
            <p className="mt-2 text-xs text-slate-500">
              health 확인 시각 {formatKstIso(health.checkedAt, true)} · 게이트 칸만 수기로 채운다
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
