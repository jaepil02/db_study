// 내비 · 셸 아이콘 — 의존성을 늘리지 않으려고 인라인 SVG(24 격자 · 선 1.8 · Lucide 모양을 따른다)
import type { NavIcon as NavIconName } from '../../lib/nav';

type Name = NavIconName | 'panelClose' | 'panelOpen';

const PATHS: Record<Name, string[]> = {
  // 규모별 성능 — 축 위 두 곡선
  perf: ['M3 3v18h18', 'M7 16c3-1 5-4 7-9', 'M7 18c4 0 8-2 11-8'],
  // 분산 흐름 — 한 점에서 갈라지는 갈래(Lucide split 모양)
  flow: ['M16 3h5v5', 'M8 3H3v5', 'M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3', 'm15 9 6-6'],
  panelClose: ['M3 3h18v18H3z', 'M9 3v18', 'm16 15-3-3 3-3'],
  panelOpen: ['M3 3h18v18H3z', 'M9 3v18', 'm14 9 3 3-3 3'],
};

export function Icon({ name, className }: { name: Name; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
