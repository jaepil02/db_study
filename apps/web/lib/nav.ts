// 공통 셸 내비게이션 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸 · docs/08_screen/README.md §화면 인벤토리
// 화면 2 — 메뉴 순서가 곧 발표 순서다(바꾸지 않는다) · 메뉴 그룹(섹션)은 두지 않는다. 화면 코드는 화면에 보이지 않으므로 여기 두지 않는다.
// 현재 화면은 경로의 가장 긴 접두로 고른다.

export type NavIcon = 'lab' | 'hmi';
export type NavItem = { href: string; label: string; icon: NavIcon };

/** 화면 2 — 메뉴 순서 그대로 */
export const NAV: readonly NavItem[] = [
  { href: '/lab', label: '직접 비교 실험', icon: 'lab' },
  { href: '/hmi', label: '설비 현황판', icon: 'hmi' },
];

/** 루트(/)가 넘어가는 첫 화면 */
export const HOME_HREF = '/lab';

const underPath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** 현재 경로의 화면 — 가장 긴 href 접두가 이긴다 · 어느 것도 아니면 null(루트 등) */
export function resolveNav(pathname: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of NAV)
    if (underPath(pathname, item.href) && (!best || item.href.length > best.href.length)) best = item;
  return best;
}
