// cn() — 글자 크기 토큰(app/globals.css @theme --text-*)과 색 클래스를 함께 줘도 크기가 지워지지 않는다
// (옛 결함: tailwind-merge가 text-foot · note · body …를 색 묶음으로 보고 뒤의 text-slate-500이 앞의 크기를 지웠다)
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cn, TEXT_SIZE_TOKENS } from '../lib/utils';

const CSS = readFileSync(path.resolve(__dirname, '..', 'app', 'globals.css'), 'utf8');

describe('cn — 글자 토큰', () => {
  it('globals.css @theme의 글자 단계와 cn이 아는 목록이 같다', () => {
    const defined = [...CSS.matchAll(/^\s*--text-([a-z]+):/gm)].map((m) => m[1]).sort();
    expect([...TEXT_SIZE_TOKENS].sort()).toEqual(defined);
  });
  it.each(TEXT_SIZE_TOKENS)('text-%s + 색 — 크기와 색이 둘 다 남는다', (t) => {
    expect(cn(`text-${t}`, 'text-slate-500')).toBe(`text-${t} text-slate-500`);
    expect(cn('text-white', `text-${t}`)).toBe(`text-white text-${t}`);
  });
  it('크기끼리 · 색끼리는 뒤가 이긴다', () => {
    expect(cn('text-body text-slate-700', 'text-head')).toBe('text-slate-700 text-head');
    expect(cn('text-note text-slate-500', 'text-amber-800')).toBe('text-note text-amber-800');
    expect(cn('text-sm', 'text-foot')).toBe('text-foot');
  });
});
