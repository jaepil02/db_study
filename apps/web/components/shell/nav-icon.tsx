// 내비 · 셸 아이콘 — 의존성을 늘리지 않으려고 인라인 SVG(24 격자 · 선 1.8 · Lucide 모양을 따른다)
import type { NavIcon as NavIconName } from '../../lib/nav';

type Name = NavIconName | 'chevronDown' | 'panelClose' | 'panelOpen';

const PATHS: Record<Name, string[]> = {
  monitor: ['M3 4h18v12H3z', 'M8 20h8', 'M12 16v4'],
  realtime: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  trend: ['M3 3v18h18', 'm19 9-5 5-4-4-3 3'],
  alarm: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  alarmConsole: ['M3 5h18', 'M3 12h18', 'M3 19h12', 'M19 17v4'],
  alarmRules: [
    'M4 21v-7',
    'M4 10V3',
    'M12 21v-9',
    'M12 8V3',
    'M20 21v-5',
    'M20 12V3',
    'M1 14h6',
    'M9 8h6',
    'M17 16h6',
  ],
  master: ['M12 2 2 7l10 5 10-5-10-5z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  experiment: ['M10 2v7.31', 'M14 9.3V2', 'M8.5 2h7', 'M14 9.3a6.5 6.5 0 1 1-4 0', 'M5.52 16h12.96'],
  console: ['M4 17 10 11 4 5', 'M12 19h8'],
  compare: ['M12 20V10', 'M18 20V4', 'M6 20v-4'],
  chevronDown: ['m6 9 6 6 6-6'],
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
