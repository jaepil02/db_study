'use client';
// 공통 셸 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸
// WebSocket 연결은 셸이 하나만 연다. 셸 요소는 메뉴 · 실험 조건 배지(OBS-06 표시 — health 1회) · WS 표지 · 무효화 신호 수신(S4 · RLT-09) ·
// 알람 통지 수신(S7 ① · RLT-08 — ALM-CONSOLE 겹침 층 · DSH 알람 띠 세션 목록 둘에 싣는다)(사용자 메뉴는 S7 ② 로그인 뒤).
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useAlarmBandStore } from '../../lib/alarm-band';
import { alarmKeys } from '../../lib/alarms';
import { useAlarmOverlay } from '../../lib/alarms-store';
import { actionsForSignal, RECONNECT_ACTIONS, type SignalAction } from '../../lib/cache-signal';
import { markMasterFresh } from '../../lib/master-api';
import { realtimeSocket, useConnectionStore } from '../../lib/realtime-socket';
import { useRealtimeStore } from '../../lib/realtime-store';
import { cn } from '../../lib/utils';
import { ExperimentBadge } from './experiment-badge';
import { WsIndicator } from './ws-indicator';

const MENU = [
  { href: '/realtime', label: '실시간' },
  { href: '/trend', label: '트렌드' },
  { href: '/alarms', label: '알람' },
  { href: '/admin/master', label: '관리' },
  { href: '/experiments', label: '실험' },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const qc = useQueryClient();
  useEffect(() => {
    // 신호 → 쿼리 키 무효화. timeseries는 어떤 신호에도 무효화하지 않는다
    // 신선 창은 신호에만 — 재연결 무효화는 BFF 사본을 거친다(쓰기는 이미 ⑤로 비웠다 · 전 탭 재연결 폭주가 api로 몰리지 않게 · 검수 N2)
    const apply = (actions: readonly SignalAction[], fresh: boolean) => {
      if (fresh && actions.some((a) => a.kind === 'query' && a.key[0] === 'master')) markMasterFresh();
      for (const a of actions) {
        if (a.kind === 'query') void qc.invalidateQueries({ queryKey: [...a.key] });
        else if (a.kind === 'realtimeTag') {
          // 그 태그를 가진 설비를 보고 있을 때만 — 최신값 쿼리는 사건 호출형(enabled false)이라 epoch로 알린다
          if (useRealtimeStore.getState().meta[a.tagId])
            useConnectionStore.setState((s) => ({ metaEpoch: s.metaEpoch + 1 }));
        }
        // permNotice — 역할 안내는 S7(로그인 사용자가 생긴 뒤)
      }
    };
    const off = realtimeSocket.on((e) => {
      if (e.type === 'cacheinv') apply(actionsForSignal(e.keys), true);
      else if (e.type === 'alarm') {
        // 알람 통지 — 콘솔 겹침 층과 대시보드 띠 세션 목록에 싣는다. 목록은 곧바로 다시 읽지 않는다: 서버 목록 캐시(cache:alarmevents)가
        // 확인 커밋 뒤에만 지워져 지금 읽어도 옛 목록이다 — 겹침 행이 생긴 뒤 TTL이 지나면 콘솔이 한 번 다시 읽는다(08_screen/05)
        // 띠 목록은 겹침 층과 수명이 달라 따로 든다 — 콘솔 반영(drop) · 재연결(clear)이 띠를 비우지 않게(08_screen/03 "이 세션에서 받은 이벤트")
        useAlarmOverlay.getState().push(e.frame);
        useAlarmBandStore.getState().push(e.frame);
      } else {
        apply(RECONNECT_ACTIONS, false);
        // 재연결 — 겹침 층을 비우고 알람 목록 재조회 1회(07_api/11 §연결 관리와 재연결 · 08_screen/05 §실시간 겹침) · 띠 세션 목록은 두고 간다
        useAlarmOverlay.getState().clear();
        void qc.invalidateQueries({ queryKey: [...alarmKeys.events()] });
      }
    });
    realtimeSocket.start();
    return () => {
      off();
      realtimeSocket.stop();
    };
  }, [qc]);
  return (
    <>
      <header className="flex h-12 items-center gap-6 border-b border-slate-200 bg-white px-4">
        <span className="font-semibold">db_study</span>
        <nav className="flex gap-4 text-sm">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={cn(
                'text-slate-500 hover:text-slate-900',
                pathname.startsWith(m.href) && 'font-medium text-slate-900',
              )}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <ExperimentBadge />
          <WsIndicator />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </>
  );
}
