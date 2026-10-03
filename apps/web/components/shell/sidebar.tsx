'use client';
// 좌측 내비 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸(레이아웃)
// 구성(위→아래): 브랜드 + 접기 토글(헤더와 같은 높이) → 화면 2행(섹션 없는 평평한 목록 · 전 행 같은 글자 · 행 높이 · 아이콘) → 스택 표기.
// 접힘(레일): 화면 아이콘만 · 현재 화면은 좌측 표지 · 이름은 title · 접힘은 이 브라우저에 저장.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { NAV, type NavItem, resolveNav } from '../../lib/nav';
import { cn } from '../../lib/utils';
import { Icon } from './nav-icon';

const COLLAPSED_KEY = 'db_study.nav.collapsed.v1';

// 브라우저 저장 — 사생활 창 · 막힌 저장소에서는 조용히 기본값으로 돈다
function readStore<T>(key: string, revive: (raw: unknown) => T, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : revive(JSON.parse(raw));
  } catch {
    return fallback;
  }
}
function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 실패는 이 세션 안에서만 유지 */
  }
}

/** 접힘 상태 — 셸이 폭을 정하려고 읽는다(첫 렌더는 펼침 · 마운트 뒤 저장값) */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setCollapsed(readStore(COLLAPSED_KEY, (v) => v === true, false)), []);
  const set = (v: boolean) => {
    setCollapsed(v);
    writeStore(COLLAPSED_KEY, v);
  };
  return [collapsed, set] as const;
}

export function Sidebar({
  pathname,
  collapsed,
  onCollapsedChange,
}: {
  pathname: string;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
}) {
  const current = resolveNav(pathname);

  if (collapsed) return <Rail current={current} onExpand={() => onCollapsedChange(false)} />;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b border-sidebar-line px-4">
        <Link href="/performance" className="flex items-center gap-2 rounded-sm">
          <Brand />
          <span className="text-[15px] font-semibold tracking-tight text-sidebar-fg-strong">db_study</span>
        </Link>
        <button
          type="button"
          aria-label="사이드바 접기"
          title="사이드바 접기"
          aria-expanded
          aria-controls="shell-nav"
          onClick={() => onCollapsedChange(true)}
          className="ml-auto inline-flex size-7 items-center justify-center rounded-sm text-sidebar-fg-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg-strong"
        >
          <Icon name="panelClose" className="size-4" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <nav
          id="shell-nav"
          aria-label="주 메뉴"
          className="flex h-full flex-col gap-0.5 overflow-y-auto px-2 py-2"
        >
          {NAV.map((it) => (
            <ScreenRow key={it.href} item={it} active={current?.href === it.href} />
          ))}
        </nav>
        {/* 아래가 더 있다는 표시 — 포인터를 통과시킨다 */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-sidebar to-transparent"
        />
      </div>

      <div className="shrink-0 border-t border-sidebar-line px-4 py-3 text-[11px] leading-relaxed text-sidebar-fg-muted">
        PLC 시계열 · 업무 데이터 실험실
        <br />
        PostgreSQL · ClickHouse · Redis
      </div>
    </div>
  );
}

/** 화면 행 — 전 행 같은 글자 · 행 높이 · 아이콘 */
function ScreenRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-[var(--nav-item-height)] items-center gap-2 rounded-sm px-2.5 text-[13px] font-medium transition-colors',
        active
          ? 'bg-sidebar-active text-sidebar-active-fg'
          : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-fg-strong',
      )}
    >
      <Icon name={item.icon} className="size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

/** 접힌 사이드바(레일) — 화면 아이콘 하나씩 · 현재 화면은 좌측 표지 */
function Rail({ current, onExpand }: { current: ReturnType<typeof resolveNav>; onExpand: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center gap-1 bg-sidebar pb-2">
      <div className="flex h-[var(--header-height)] w-full shrink-0 items-center justify-center border-b border-sidebar-line">
        <Link href="/performance" aria-label="db_study 홈" className="rounded-sm p-1">
          <Brand />
        </Link>
      </div>
      <button
        type="button"
        aria-label="사이드바 펼치기"
        title="사이드바 펼치기"
        aria-expanded={false}
        aria-controls="shell-nav"
        onClick={onExpand}
        className="mt-1 inline-flex size-8 items-center justify-center rounded-sm text-sidebar-fg-muted transition-colors hover:bg-sidebar-hover hover:text-sidebar-fg-strong"
      >
        <Icon name="panelOpen" className="size-4" />
      </button>
      <div aria-hidden className="my-1 h-px w-6 bg-sidebar-line" />
      <nav id="shell-nav" aria-label="주 메뉴" className="flex flex-col items-center gap-1">
        {NAV.map((it) => {
          const on = current?.href === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-label={it.label}
              title={it.label}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'relative inline-flex size-9 items-center justify-center rounded-sm transition-colors',
                on
                  ? 'bg-sidebar-hover text-sidebar-fg-strong'
                  : 'text-sidebar-fg hover:bg-sidebar-hover hover:text-sidebar-fg-strong',
              )}
            >
              {on ? (
                <span
                  aria-hidden
                  className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r bg-accent"
                />
              ) : null}
              <Icon name={it.icon} className="size-4" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Brand() {
  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-[11px] font-bold text-white">
      DB
    </span>
  );
}
