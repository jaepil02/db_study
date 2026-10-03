// shadcn/ui 관례의 클래스 병합 도우미
import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// globals.css @theme이 더한 글자 단계(text-label 13 · text-answer 28)를 글자 크기 묶음으로 알린다 —
// 모르면 tailwind-merge가 색 클래스(text-slate-500 등)와 같은 묶음으로 보고 앞의 크기 클래스를 지운다.
const twMerge = extendTailwindMerge({ extend: { theme: { text: ['label', 'answer'] } } });

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
