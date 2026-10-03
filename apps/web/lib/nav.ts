// 공통 셸 내비게이션 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸 · 리드 지침 .omc/web2-brief.md §1
// 화면 2개(D-14 · 사용자 결정 2026-10-03)를 섹션 없는 평평한 목록으로 낸다 — 화면 코드는 화면에 보이지 않으므로 여기 두지 않는다.
// 현재 화면은 경로의 가장 긴 접두로 고른다.

export type NavIcon = 'perf' | 'flow';
export type NavItem = { href: string; label: string; icon: NavIcon };

export const NAV: readonly NavItem[] = [
  { href: '/performance', label: '성능 비교', icon: 'perf' },
  { href: '/monitoring', label: '분산 처리 모니터링', icon: 'flow' },
];

const underPath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** 현재 경로의 화면 — 가장 긴 href 접두가 이긴다 · 어느 것도 아니면 null(루트 등) */
export function resolveNav(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of NAV)
    if (underPath(pathname, item.href) && (!best || item.href.length > best.href.length)) best = item;
  return best;
}
