'use client';
// 좌측 내비 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸(레이아웃)
// 구성(위→아래): 브랜드 + 접기 토글(헤더와 같은 높이) → 내비 트리(자체 스크롤 · 아래 페이드) → 스택 표기.
// 트리 규약: 위계는 들여쓰기로만(전 depth 같은 글자 · 행 높이 · 아이콘) · 섹션은 다중 확장이고 펼침은 이 브라우저에 저장 ·
// 현재 화면의 섹션은 화면이 바뀌는 순간 추가로 연다(열어 둔 다른 섹션은 닫지 않는다) · 항목 하나뿐인 섹션은 최상위 행.
// 접힘(레일): 섹션 아이콘만 · 누르면 그 섹션의 첫 화면(flat이면 그 화면) · 이름은 title.
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  EMPTY_EXPANSION,
  isExpanded,
  NAV,
  type NavExpansion,
  type NavItem,
  type NavSection,
  resolveNav,
  reviveExpansion,
  setExpanded,
} from '../../lib/nav';
import { cn } from '../../lib/utils';
import { Icon } from './nav-icon';

const EXPANSION_KEY = 'db_study.nav.expanded.v1';
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
  const [expansion, setExpansion] = useState<NavExpansion>(EMPTY_EXPANSION);
  useEffect(() => setExpansion(readStore(EXPANSION_KEY, reviveExpansion, EMPTY_EXPANSION)), []);
  const update = (next: NavExpansion) => {
    setExpansion(next);
    writeStore(EXPANSION_KEY, next);
  };

  // 현재 화면의 섹션을 화면이 바뀐 순간에만 추가로 연다 — 저장값이 바뀔 때마다 열면 사용자가 접는 즉시 다시 펼쳐진다
  const lastCode = useRef<string | null>(null);
  const code = current?.item.code ?? null;
  const sectionId = current?.section.id ?? null;
  useEffect(() => {
    if (code === lastCode.current) return;
    lastCode.current = code;
    if (!sectionId) return;
    setExpansion((s) => {
      if (isExpanded(s, sectionId)) return s;
      const next = setExpanded(s, [sectionId], true);
      writeStore(EXPANSION_KEY, next);
      return next;
    });
  }, [code, sectionId]);

  if (collapsed) return <Rail current={current} onExpand={() => onCollapsedChange(false)} />;

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-[var(--header-height)] shrink-0 items-center gap-2 border-b border-sidebar-line px-4">
        <Link href="/realtime" className="flex items-center gap-2 rounded-sm">
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
          {NAV.map((sec) =>
            sec.flat ? (
              sec.items.map((it) => (
                <ScreenRow key={it.href} item={it} depth={0} active={current?.item.href === it.href} />
              ))
            ) : (
              <SectionBranch
                key={sec.id}
                section={sec}
                expanded={isExpanded(expansion, sec.id)}
                containsActive={current?.section.id === sec.id}
                activeHref={current?.item.href ?? null}
                onToggle={() => update(setExpanded(expansion, [sec.id], !isExpanded(expansion, sec.id)))}
              />
            ),
          )}
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

function SectionBranch({
  section,
  expanded,
  containsActive,
  activeHref,
  onToggle,
}: {
  section: NavSection;
  expanded: boolean;
  containsActive: boolean;
  activeHref: string | null;
  onToggle: () => void;
}) {
  const panelId = `nav-section-${section.id}`;
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          'flex h-[var(--nav-item-height)] w-full items-center justify-between gap-2 rounded-sm pr-2.5 pl-2.5',
          'text-[13px] font-medium transition-colors',
          containsActive ? 'text-sidebar-fg-strong' : 'text-sidebar-fg-muted',
          'hover:bg-sidebar-hover hover:text-sidebar-fg-strong',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon name={section.icon} className="size-4 shrink-0" />
          <span className="truncate">{section.label}</span>
        </span>
        <Icon
          name="chevronDown"
          className={cn('size-3.5 shrink-0 transition-transform duration-150', expanded && 'rotate-180')}
        />
      </button>
      <div id={panelId} hidden={!expanded} className="flex flex-col gap-px pt-0.5 pb-1">
        {section.items.map((it) => (
          <ScreenRow key={it.href} item={it} depth={1} active={activeHref === it.href} />
        ))}
      </div>
    </div>
  );
}

/** 화면 행 — 어느 depth에 놓이든 크기 · 굵기가 같고 들여쓰기만 다르다 */
function ScreenRow({ item, depth, active }: { item: NavItem; depth: 0 | 1; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-[var(--nav-item-height)] items-center gap-2 rounded-sm pr-2.5 text-[13px] font-medium transition-colors',
        depth === 0 ? 'pl-2.5' : 'pl-7',
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

/** 접힌 사이드바(레일) — 섹션 아이콘 하나씩 · 현재 섹션은 좌측 표지 */
function Rail({ current, onExpand }: { current: ReturnType<typeof resolveNav>; onExpand: () => void }) {
  return (
    <div className="flex h-full w-full flex-col items-center gap-1 bg-sidebar pb-2">
      <div className="flex h-[var(--header-height)] w-full shrink-0 items-center justify-center border-b border-sidebar-line">
        <Link href="/realtime" aria-label="db_study 홈" className="rounded-sm p-1">
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
        {NAV.map((sec) => {
          const on = current?.section.id === sec.id;
          const target = on && current ? current.item : sec.items[0];
          if (!target) return null;
          // 이름은 실제로 가는 화면 — 섹션을 누르면 그 섹션의 첫 화면(현재 섹션이면 지금 화면)으로 간다
          const name = sec.flat ? target.label : `${sec.label} — ${target.label}`;
          return (
            <Link
              key={sec.id}
              href={target.href}
              aria-label={name}
              title={name}
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
              <Icon name={sec.icon} className="size-4" />
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
