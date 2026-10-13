'use client';
// 공통 셸 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸
// 셸 요소는 메뉴 · 머리 동작 자리(HeaderActions)다.
// 레이아웃: 좌측 내비(248 · sidebar.tsx · 접으면 레일) + 콘텐츠 머리(--header-height 44 → 64 · 고정 · 화면 이름 · 우측 동작) + 콘텐츠 본문.
// 반응형(정본 docs/08_screen/01_standards.md §반응형 규칙): 맞춤 보기(fit: — 1280×720 이상)에서는 본문 안쪽 틀이 본문 높이에 꼭 맞고
// 화면 틀(components/shell/screen.tsx)이 그 높이를 나눠 써서 페이지 스크롤이 0이다. 그보다 작으면 본문만 세로로 스크롤한다 · 가로 넘침은 늘 숨긴다.
// 본문 폭은 상한을 두지 않는다 — 2560까지 화면이 넓어지는 만큼 그림이 는다(여백은 --shell-pad 12 → 20).
// 머리에는 화면 이름(h1)만 — 화면 코드는 화면에 보이지 않는다(docs/08_screen/01_standards.md §한 화면 원칙 용어표).
import { usePathname } from 'next/navigation';
import { type ReactNode, useMemo, useState } from 'react';
import { resolveNav } from '../../lib/nav';
import { cn } from '../../lib/utils';
import { HeaderSlotContext, type HeaderSlots } from './header-actions';
import { Sidebar, useSidebarCollapsed } from './sidebar';

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [actions, setActions] = useState<HTMLElement | null>(null);
  const slots = useMemo<HeaderSlots>(() => ({ actions }), [actions]);
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
          className="flex h-[var(--header-height)] shrink-0 items-center gap-3 border-b border-line bg-surface px-[var(--shell-pad)]"
        >
          <h1 className="min-w-0 truncate text-head font-semibold text-sidebar-fg-strong">
            {current ? current.label : 'db_study'}
          </h1>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div ref={setActions} className="flex items-center gap-2" data-shell="header-actions" />
          </div>
        </header>
        {/* relative — 본문 안 absolute 요소(sr-only legend 등)의 포함 블록을 본문에 가둔다 · 없으면 초기 포함 블록 기준으로 놓여 문서 높이를 키운다(본문만 스크롤 위반) */}
        <main data-shell="content-body" className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          {/* 맞춤 보기에서는 본문 높이 그대로(h-full) — 화면 틀이 남는 높이를 그림에 준다 · 작은 화면은 내용 높이대로 쌓인다 */}
          <div data-shell="content-frame" className="w-full p-[var(--shell-pad)] fit:h-full">
            <HeaderSlotContext.Provider value={slots}>{children}</HeaderSlotContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}
