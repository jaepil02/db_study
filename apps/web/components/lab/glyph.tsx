// 화면 기호 — 유니코드 기호(✓ ✕) 대신 그린 SVG(24 격자 · Lucide 모양) · 장식이라 aria-hidden(뜻은 옆 글자가 말한다)
// 크기는 글자를 따라간다(기본 1em) — 화면 크기에 따라 글자 토큰이 늘면 기호도 같이 는다.
import { cn } from '../../lib/utils';

type Name = 'check' | 'cross';

const PATHS: Record<Name, string[]> = {
  check: ['M20 6 9 17l-5-5'],
  cross: ['M18 6 6 18', 'm6 6 12 12'],
};

export function Glyph({ name, className }: { name: Name; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-[1em] shrink-0', className)}
      aria-hidden="true"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
