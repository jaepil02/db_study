// shadcn/ui Badge 모양을 따라 직접 작성 — 변형은 이 화면들이 쓰는 넷만
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const VARIANTS = {
  default: 'border-transparent bg-slate-800 text-white',
  outline: 'border-slate-300 text-slate-700',
  warning: 'border-transparent bg-amber-100 text-amber-800',
  danger: 'border-transparent bg-red-100 text-red-700',
  success: 'border-transparent bg-emerald-100 text-emerald-700',
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof VARIANTS;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
