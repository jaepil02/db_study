'use client';
// 공통 셸 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸
// WebSocket 연결은 셸이 하나만 연다(/monitoring의 flow 구독이 쓴다). 셸 요소는 메뉴 · WS 표지(/monitoring에서만) · 머리 동작 자리(HeaderActions).
// 레이아웃: 좌측 내비(248 · sidebar.tsx · 접으면 레일) + 콘텐츠 머리(56 · 고정 · 화면 이름 · 우측 동작 · 표지) + 콘텐츠 본문(이 영역만 스크롤 — 두 화면은 1440 × 900에서 스크롤 0이 목표).
// 머리에는 화면 이름(h1)만 — 화면 코드(EXP-PERF · EXP-FLOW)는 화면에 보이지 않는다(설계 .omc/plans/web-junior-redesign.md §4 용어표).
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { resolveNav } from '../../lib/nav';
import { realtimeSocket } from '../../lib/realtime-socket';
import { cn } from '../../lib/utils';
import { HeaderSlotContext, type HeaderSlots } from './header-actions';
import { Sidebar, useSidebarCollapsed } from './sidebar';
import { WsIndicator } from './ws-indicator';

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState<HTMLElement | null>(null);
  const slots = useMemo<HeaderSlots>(() => ({ actions, status }), [actions, status]);
  useEffect(() => {
    realtimeSocket.start();
    return () => realtimeSocket.stop();
  }, []);
  const current = resolveNav(pathname);
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      <aside
        data-shell="nav"
        className={cn(
          'shrink-0 border-r border-sidebar-line',
          collapsed ? 'w-[var(--sidebar-rail-width)]' : 'w-[var(--sidebar-width)]',
        )}
      >
        <Sidebar pathname={pathname} collapsed={collapsed} onCollapsedChange={setCollapsed} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          data-shell="content-header"
          className="flex h-[var(--header-height)] shrink-0 items-center gap-3 border-b border-line bg-surface px-5"
        >
          <h1 className="min-w-0 truncate text-base font-semibold text-sidebar-fg-strong">
            {current ? current.label : 'db_study'}
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div ref={setActions} className="flex items-center gap-2" data-shell="header-actions" />
            {current?.href === '/monitoring' ? <WsIndicator statusSlot={setStatus} /> : null}
          </div>
        </header>
        {/* relative — 본문 안 absolute 요소(sr-only legend 등)의 포함 블록을 본문에 가둔다 · 없으면 초기 포함 블록 기준으로 놓여 문서 높이를 키운다(본문만 스크롤 위반) */}
        <main data-shell="content-body" className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-5">
            <HeaderSlotContext.Provider value={slots}>{children}</HeaderSlotContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}
