// 화면 공통 아이콘 — 유니코드 기호(▶ ■ ⚠ ✓ ✕ ⓘ) 대신 그린 SVG 한 벌(24 격자 · 선 2 · Lucide 모양) · 내비 아이콘은 shell/nav-icon.tsx
// 장식이라 aria-hidden — 뜻은 옆 글자나 감싼 요소의 이름(aria-label · sr-only)이 말한다.
type Name = 'play' | 'stop' | 'warn' | 'check' | 'cross' | 'info';

const PATHS: Record<Name, string[]> = {
  play: ['M7 4.5v15l12-7.5z'],
  stop: ['M6 6h12v12H6z'],
  warn: [
    'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  check: ['M20 6 9 17l-5-5'],
  cross: ['M18 6 6 18', 'm6 6 12 12'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
};

/** 채움 모양(재생 · 정지)은 면으로 · 나머지는 선으로 */
const FILLED = new Set<Name>(['play', 'stop']);

export function UiIcon({ name, className }: { name: Name; className?: string }) {
  const filled = FILLED.has(name);
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1 : 2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-3.5'}
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
