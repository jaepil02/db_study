'use client';
// 공통 셸 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸
// WebSocket 연결은 셸이 하나만 연다. S2 셸 요소는 메뉴 · WS 표지 한 줄(실험 조건 배지 · 사용자 메뉴는 이후 단계).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { realtimeSocket } from '../../lib/realtime-socket';
import { cn } from '../../lib/utils';
import { WsIndicator } from './ws-indicator';

const MENU = [
  { href: '/realtime', label: '실시간' },
  { href: '/experiments', label: '실험' },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    realtimeSocket.start();
    return () => realtimeSocket.stop();
  }, []);
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
