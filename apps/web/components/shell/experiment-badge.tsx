'use client';
// 실험 조건 배지 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸(OBS-06 표시)
// 셸이 진입 시 BFF 경유 health를 1회 읽고 기본값과 다른 스위치를 센다 · 누르면 EXP-CONSOLE.
// 주기 재조회를 하지 않는다 — EXP-CONSOLE이 같은 쿼리 키로 폴링하면 그 값을 따라간다.
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchHealth, HEALTH_KEY } from '../../lib/health';
import { buildSwitchRows, countNonDefault } from '../../lib/switches';
import { cn } from '../../lib/utils';

export function useShellHealth() {
  return useQuery({
    queryKey: HEALTH_KEY,
    queryFn: fetchHealth,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function ExperimentBadge() {
  const q = useShellHealth();
  const health = q.data?.body;
  const n = health ? countNonDefault(buildSwitchRows(health.switches)) : null;
  const label =
    n === null ? (q.isError ? '실험 조건 ?' : '실험 조건 …') : n === 0 ? '기본 구성' : `실험 조건 ${n}`;
  return (
    <Link
      href="/experiments"
      data-shell="experiment-badge"
      title={
        n === null
          ? q.isError
            ? 'health를 읽지 못했다 — 실험 콘솔에서 확인한다'
            : 'health 읽는 중'
          : `기본값과 다른 스위치 ${n} — 누르면 실험 콘솔`
      }
      className={cn(
        'rounded-full border px-3 py-1 text-sm font-medium',
        n !== null && n > 0
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100',
      )}
    >
      {label}
    </Link>
  );
}
