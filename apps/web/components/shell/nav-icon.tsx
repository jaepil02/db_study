// 내비 · 셸 아이콘 — 의존성을 늘리지 않으려고 인라인 SVG(24 격자 · 선 1.8 · Lucide 모양을 따른다)
import type { NavIcon as NavIconName } from '../../lib/nav';

type Name = NavIconName | 'panelClose' | 'panelOpen';

const PATHS: Record<Name, string[]> = {
  // 직접 비교 실험 — 플라스크(Lucide flask-conical)
  lab: [
    'M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2',
    'M6.453 15h11.094',
    'M8.5 2h7',
  ],
  // 분산 흐름 — 한 점에서 갈라지는 갈래(Lucide split 모양)
  flow: ['M16 3h5v5', 'M8 3H3v5', 'M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3', 'm15 9 6-6'],
  // 설비 현황판 — 공장(Lucide factory)
  hmi: [
    'M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z',
    'M17 18h1',
    'M12 18h1',
    'M7 18h1',
  ],
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
