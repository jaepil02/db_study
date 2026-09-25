'use client';
// 공통 셸 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸
// WebSocket 연결은 셸이 하나만 연다. 셸 요소는 메뉴 · WS 표지 · 무효화 신호 수신(S4 · RLT-09)(실험 조건 배지 · 사용자 메뉴는 이후 단계).
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { actionsForSignal, RECONNECT_ACTIONS, type SignalAction } from '../../lib/cache-signal';
import { markMasterFresh } from '../../lib/master-api';
import { realtimeSocket, useConnectionStore } from '../../lib/realtime-socket';
import { useRealtimeStore } from '../../lib/realtime-store';
import { cn } from '../../lib/utils';
import { WsIndicator } from './ws-indicator';

const MENU = [
  { href: '/realtime', label: '실시간' },
  { href: '/trend', label: '트렌드' },
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
    const off = realtimeSocket.on((e) =>
      e.type === 'cacheinv' ? apply(actionsForSignal(e.keys), true) : apply(RECONNECT_ACTIONS, false),
    );
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
        <div className="ml-auto">
          <WsIndicator />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </>
  );
}
