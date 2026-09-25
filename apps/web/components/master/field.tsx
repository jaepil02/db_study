// 폼 입력 한 줄 — 라벨 · 입력 · 필드 옆 오류 문구(08_screen/01 §에러 코드별 사용자 표시)
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const box =
  'w-full rounded border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-100 disabled:text-slate-500';

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: children이 입력 요소다(label이 감싼다)
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      <span>{label}</span>
      {children}
      {error ? <span className="text-red-600">{error}</span> : null}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(box, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(box, className)} {...props} />;
}

export function Button({
  className,
  variant = 'default',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'danger' }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded px-3 py-1 text-sm disabled:opacity-50',
        variant === 'default' && 'bg-slate-800 text-white hover:bg-slate-700',
        variant === 'outline' && 'border border-slate-300 bg-white hover:bg-slate-50',
        variant === 'danger' && 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
        className,
      )}
      {...props}
    />
  );
}

/** 숫자 칸 — 빈 칸은 null */
export const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v));
