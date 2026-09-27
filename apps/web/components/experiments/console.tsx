'use client';
// EXP-CONSOLE — 정본 docs/08_screen/07_experiment_console.md (요소 10: 저장소 상태 · 스위치 표 · 조합 경고 ·
// 앱 · 파이프라인 메트릭 요약 · 저장소 메트릭 요약 · 키 계열별 메모리 · E2E 게이지 · 전환 절차(정적) · 기록 조건 블록 · 정밀 측정 모드).
// 표시 전용 — 스위치를 바꾸는 손잡이가 없다.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { CONSOLE_POLL_MS } from '../../lib/config';
import { fetchHealth, HEALTH_KEY } from '../../lib/health';
import { type ConsoleSummary, cacheHitRatio, ratePerSecond, sumModes } from '../../lib/metrics-parser';
import { buildSwitchRows, comboWarnings, countNonDefault } from '../../lib/switches';
import { formatKst, formatKstIso } from '../../lib/time';
import { Badge } from '../ui/badge';
import { Band } from '../ui/band';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { type DerivedRates, MetricCards } from './metric-cards';
import { RecordBlock } from './record-block';
import { StoreStatus } from './store-status';
import { SwitchTable } from './switch-table';

/** 전환 절차 안내(정적) — 08_screen/07 §전환 절차 ①~⑤. ③을 건너뛰면 기본 구현이 그대로 주입된 기동에서 측정한다 */
const SWITCH_STEPS: [string, string][] = [
  ['① 환경변수 변경', '.env의 해당 변수(예: REDIS_LATEST_CACHE=off) — .env는 커밋하지 않는다'],
  ['② api 재기동', '환경변수는 모듈 초기화 때만 읽힌다 — 명령 정본 09_tech_stack/04_local_environment'],
  ['③ 주입 구현 확인', '이 화면 새로고침 → "현재" 열이 대안 구현인가 · 조합 경고 확인'],
  ['④ 기준 상태 복원', '스냅샷 복원 · 캐시 키 초기화 — 절차 정본 10_observability/04_experiment_protocol'],
  ['⑤ 측정 · 기록', '측정 창을 EXP-COMPARE에서 잡고 · 기록 조건 블록을 docs/measurements에 붙인다'],
];

async function fetchMetrics(): Promise<{ fetchedAt: number; summary: ConsoleSummary }> {
  let res: Response;
  try {
    res = await fetch('/bff/metrics', { cache: 'no-store' });
  } catch {
    throw new ApiError(0, null, 'BFF에 닿지 못했다');
  }
  if (!res.ok) throw new ApiError(res.status, null, `HTTP ${res.status}`);
  return (await res.json()) as { fetchedAt: number; summary: ConsoleSummary };
}

export function ExperimentConsole() {
  // 정밀 측정 모드 — 켜면 이 화면의 모든 폴링을 멈춘다(브라우저 안 설정)
  const [precise, setPrecise] = useState(false);

  const healthQ = useQuery({
    queryKey: HEALTH_KEY,
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

  // 두 폴링 사이 누적값 차 — 생성기 pps(모드 A~D 합) · 조회 캐시 히트율(tsq_cache_requests_total)
  const prev = useRef<{ atMs: number; gen: number | null; cache: ConsoleSummary['cacheRequests'] } | null>(
    null,
  );
  const [derived, setDerived] = useState<DerivedRates>({ genPps: null, hitRatio: null });
  useEffect(() => {
    const d = metricsQ.data;
    if (!d) return;
    const cur = {
      atMs: d.fetchedAt,
      gen: sumModes(d.summary.genPointsByMode),
      cache: d.summary.cacheRequests,
    };
    const p = prev.current;
    if (p?.atMs === cur.atMs) return;
    setDerived({
      genPps: ratePerSecond(p ? { value: p.gen, atMs: p.atMs } : null, { value: cur.gen, atMs: cur.atMs }),
      hitRatio: cacheHitRatio(p?.cache ?? null, cur.cache),
    });
    prev.current = cur;
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
        derived={derived}
        failed={metricsQ.isError}
        lastSuccessAt={metricsQ.dataUpdatedAt}
      />

      <Card>
        <CardHeader>
          <CardTitle>전환 절차 — 스위치는 호스트 셸에서 바꾼다</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-1 text-sm">
            {SWITCH_STEPS.map(([step, text]) => (
              <li key={step}>
                <span className="font-medium">{step}</span> <span className="text-slate-600">{text}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

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
