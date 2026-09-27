// 공통 셸 내비게이션 트리 — 정본 docs/08_screen/01_standards.md §요청 경로와 공통 셸(레이아웃)
// 섹션(1depth) + 화면(2depth) 트리다. 섹션 4 · 화면 7 — 항목이 하나뿐인 섹션(관리)은 헤더 없이 최상위 행(flat)으로 낸다.
// 화면 7 = 08_screen 인벤토리 10 − AUTH-LOGIN(메뉴 아님) − ADM-WORKORDER · ADM-AUDIT(S7 도입 시 관리 섹션에 더하고 flat을 푼다).
// 현재 화면은 경로의 가장 긴 접두로 고른다(/alarms/rules/3 → 알람 규칙 · /realtime/tag/5 → 실시간 대시보드).

export type NavIcon =
  | 'monitor'
  | 'realtime'
  | 'trend'
  | 'alarm'
  | 'alarmConsole'
  | 'alarmRules'
  | 'master'
  | 'experiment'
  | 'console'
  | 'compare';
export type NavItem = { href: string; label: string; code: string; icon: NavIcon };
export type NavSection = {
  id: string;
  label: string;
  icon: NavIcon;
  flat?: boolean;
  items: readonly NavItem[];
};

export const NAV: readonly NavSection[] = [
  {
    id: 'monitor',
    label: '모니터링',
    icon: 'monitor',
    items: [
      { href: '/realtime', label: '실시간 대시보드', code: 'DSH-REALTIME', icon: 'realtime' },
      { href: '/trend', label: '트렌드 분석', code: 'ANL-TREND', icon: 'trend' },
    ],
  },
  {
    id: 'alarm',
    label: '알람',
    icon: 'alarm',
    items: [
      { href: '/alarms', label: '알람 콘솔', code: 'ALM-CONSOLE', icon: 'alarmConsole' },
      { href: '/alarms/rules', label: '알람 규칙', code: 'ALM-RULES', icon: 'alarmRules' },
    ],
  },
  {
    id: 'admin',
    label: '관리',
    icon: 'master',
    flat: true,
    items: [{ href: '/admin/master', label: '마스터 관리', code: 'ADM-MASTER', icon: 'master' }],
  },
  {
    id: 'experiment',
    label: '실험',
    icon: 'experiment',
    items: [
      { href: '/experiments', label: '실험 콘솔', code: 'EXP-CONSOLE', icon: 'console' },
      { href: '/experiments/compare', label: '실험 비교', code: 'EXP-COMPARE', icon: 'compare' },
    ],
  },
];

/** 처음 열었을 때 펼쳐 두는 섹션 — 사용자가 손댄 뒤에는 저장된 선택이 이긴다 */
export const NAV_DEFAULT_EXPANDED: readonly string[] = ['monitor', 'alarm', 'experiment'];

const underPath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** 현재 경로의 섹션과 화면 — 가장 긴 href 접두가 이긴다 · 어느 것도 아니면 null(루트 등) */
export function resolveNav(pathname: string): { section: NavSection; item: NavItem } | null {
  let best: { section: NavSection; item: NavItem } | null = null;
  for (const section of NAV)
    for (const item of section.items)
      if (underPath(pathname, item.href) && (!best || item.href.length > best.item.href.length))
        best = { section, item };
  return best;
}

/** 펼침 상태 — 기본값과 다르게 사용자가 연 것 · 닫은 것만 저장한다(기본값이 바뀌어도 손대지 않은 섹션은 새 기본값을 따른다) */
export type NavExpansion = { opened: string[]; closed: string[] };
export const EMPTY_EXPANSION: NavExpansion = { opened: [], closed: [] };

export function isExpanded(state: NavExpansion, id: string): boolean {
  if (state.opened.includes(id)) return true;
  if (state.closed.includes(id)) return false;
  return NAV_DEFAULT_EXPANDED.includes(id);
}

export function setExpanded(state: NavExpansion, ids: readonly string[], open: boolean): NavExpansion {
  const opened = new Set(state.opened);
  const closed = new Set(state.closed);
  for (const id of ids) {
    opened.delete(id);
    closed.delete(id);
    const dflt = NAV_DEFAULT_EXPANDED.includes(id);
    if (open && !dflt) opened.add(id);
    if (!open && dflt) closed.add(id);
  }
  return { opened: [...opened], closed: [...closed] };
}

/** 저장값 복원 — 모양이 어긋나면 빈 상태(기본값)로 */
export function reviveExpansion(raw: unknown): NavExpansion {
  if (!raw || typeof raw !== 'object') return EMPTY_EXPANSION;
  const o = raw as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return { opened: list(o.opened), closed: list(o.closed) };
}
