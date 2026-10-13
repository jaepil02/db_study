// shadcn/ui 관례의 클래스 병합 도우미
import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * app/globals.css @theme이 더한 글자 단계 — 고정 2(label 13 · answer 28) + 늘고 주는 7(foot · note · body · head · title · big · hero).
 * tailwind-merge에 글자 크기 묶음으로 알린다 — 모르면 색 클래스(text-slate-500 등)와 같은 묶음으로 보고 앞의 크기 클래스를 지운다.
 * globals.css에 --text-* 단계를 더하거나 지우면 여기도 함께 고친다(test/cn.test.ts가 두 목록을 맞춰 본다).
 */
export const TEXT_SIZE_TOKENS = [
  'label',
  'answer',
  'foot',
  'note',
  'body',
  'head',
  'title',
  'big',
  'hero',
] as const;

const twMerge = extendTailwindMerge({ extend: { theme: { text: [...TEXT_SIZE_TOKENS] } } });

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
