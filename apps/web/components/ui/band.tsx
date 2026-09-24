// 영역 띠 — 에러 코드별 사용자 표시(08_screen/01)의 "영역 띠" 자리
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export function Band({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'warning' | 'info';
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        'rounded-md px-3 py-2 text-sm',
        tone === 'danger' && 'bg-red-50 text-red-700',
        tone === 'warning' && 'bg-amber-50 text-amber-800',
        tone === 'info' && 'bg-slate-100 text-slate-600',
      )}
    >
      {children}
    </div>
  );
}
