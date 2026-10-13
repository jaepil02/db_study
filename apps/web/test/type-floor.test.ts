// 글자 바닥 — 화면 안 최소 12px · 글자 단계 12 · 13 · 14 · 16 · 20 · 28만(docs/08_screen/01_standards.md §글자와 화면 표면)
// 대상: 모니터링(components/experiments/flow — §7.1 R14) · 차트 래퍼 · 셸 · 실행 패널 · 공통 조각 · app. 흐름도 SVG 배율을 곱한 실제 크기는 test/flow-layout이 따로 본다.
// 늘고 주는 글자 토큰(text-foot · note · body · head · title · big · hero — app/globals.css)은 clamp 바닥이 12px 이상이라 단계 밖 크기 검사에 걸리지 않는다(아래 "글자 토큰 바닥" 시험).
// 소스 — 임의 px 글자 크기(text-[11px] 등) · 단계 밖 Tailwind 크기(text-lg · text-2xl …) · 12 미만 fontSize(SVG · 캔버스 옵션) 금지 ·
//    1px 넘는 테두리(Tailwind 단계 border-2 · border-l-4 · 임의 값 border-[3px] · 인라인 style borderWidth · borderLeft: '4px …' · CSS border: 2px) 금지(craft floor)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  'components/experiments/flow',
  'components/experiments/echart.tsx',
  'components/shell',
  'components/runs',
  'components/ui',
  'components/lab',
  'components/hmi',
  'components/controls',
  'app',
];

function files(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((n) => {
    const p = path.join(abs, n);
    if (statSync(p).isDirectory()) return files(path.relative(ROOT, p));
    return /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

const SOURCES = TARGETS.flatMap(files).map((p) => ({
  name: path.relative(ROOT, p),
  text: readFileSync(p, 'utf8'),
}));

/** 1px 넘는 테두리 — 찾은 조각 목록(단계 · 임의 값 · 인라인 style · CSS) */
function wideBorders(text: string): string[] {
  const px = (v: string | undefined, unit: string | undefined = 'px') =>
    Number(v ?? '0') * (unit === 'rem' ? 16 : 1);
  return [
    // Tailwind 단계 — border-2 · border-l-4 · border-x-8 · border-s-2(border-0 · border 한 겹은 통과)
    ...[...text.matchAll(/\bborder(?:-[lrtbxyse])?-(\d+(?:\.\d+)?)\b/g)]
      .filter((m) => px(m[1]) > 1)
      .map((m) => m[0]),
    // 임의 값 — border-[3px] · border-l-[0.25rem]
    ...[...text.matchAll(/\bborder(?:-[lrtbxyse])?-\[(\d*(?:\.\d+)?)(px|rem)\]/g)]
      .filter((m) => px(m[1], m[2]) > 1)
      .map((m) => m[0]),
    // 인라인 style={{ … }} — borderWidth: 2 · borderLeftWidth: '3px' · borderLeft: '4px solid …' · border: '2px solid'
    // (style 블록 안만 본다 — ECharts 옵션의 itemStyle.borderWidth는 캔버스 점 테두리라 CSS 테두리가 아니다)
    ...[...text.matchAll(/style=\{\{([\s\S]*?)\}\}/g)].flatMap((b) =>
      [
        ...(b[1] ?? '').matchAll(
          /\bborder(?:Left|Right|Top|Bottom|Inline|Block)?(?:Start|End)?(?:Width)?\s*:\s*['"`]?(\d*(?:\.\d+)?)(px|rem)?/g,
        ),
      ]
        .filter((m) => px(m[1], m[2]) > 1)
        .map((m) => `style ${m[0]}`),
    ),
    // CSS — border: 2px · border-left: 4px · border-width: 3px
    ...[
      ...text.matchAll(
        /\bborder(?:-(?:left|right|top|bottom|inline|block)(?:-(?:start|end))?)?(?:-width)?\s*:\s*(\d*(?:\.\d+)?)(px|rem)/g,
      ),
    ]
      .filter((m) => px(m[1], m[2]) > 1)
      .map((m) => m[0]),
  ];
}

describe('글자 바닥 — 소스', () => {
  it('대상 파일을 실제로 읽었다', () => {
    expect(SOURCES.map((s) => s.name)).toEqual(
      expect.arrayContaining([
        'components/experiments/echart.tsx',
        'components/experiments/flow/flow-screen.tsx',
        'components/experiments/flow/flow-diagram.tsx',
        'components/shell/sidebar.tsx',
        'components/runs/run-progress.tsx',
        'components/lab/lab-screen.tsx',
        'app/layout.tsx',
      ]),
    );
  });

  it('임의 px 글자 크기 없음 — 크기는 단계 토큰으로만', () => {
    const bad = SOURCES.flatMap((s) =>
      [...s.text.matchAll(/\btext-\[(\d+(?:\.\d+)?)(px|rem)\]/g)].map((m) => `${s.name}: ${m[0]}`),
    );
    expect(bad).toEqual([]);
  });

  it('단계 밖 Tailwind 글자 크기 없음(text-lg · text-2xl …) — 12 xs · 13 label · 14 sm · 16 base · 20 xl · 28 answer', () => {
    const bad = SOURCES.flatMap((s) =>
      [...s.text.matchAll(/\btext-(lg|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g)].map((m) => `${s.name}: ${m[0]}`),
    );
    expect(bad).toEqual([]);
  });

  it('SVG · 캔버스 fontSize는 12 이상', () => {
    const bad = SOURCES.flatMap((s) =>
      [...s.text.matchAll(/fontSize[=:]\s*\{?\s*(\d+(?:\.\d+)?)/g)]
        .filter((m) => Number(m[1]) < 12)
        .map((m) => `${s.name}: ${m[0]}`),
    );
    expect(bad).toEqual([]);
  });

  it('글자 토큰 바닥 — globals.css의 늘고 주는 글자 토큰은 clamp 바닥이 12px(0.75rem) 이상', () => {
    const css = SOURCES.find((s) => s.name === 'app/globals.css')?.text ?? '';
    const tokens = [...css.matchAll(/--text-([a-z]+):\s*clamp\(([\d.]+)rem/g)].map((m) => [
      m[1],
      Number(m[2]) * 16,
    ]);
    expect(tokens.map((t) => t[0])).toEqual(['foot', 'note', 'body', 'head', 'title', 'big', 'hero']);
    expect(tokens.filter((t) => (t[1] as number) < 12)).toEqual([]);
  });

  it('금지 패턴 — 1px 넘는 테두리 없음(단계 · 임의 값 · 인라인 style · CSS)', () => {
    expect(SOURCES.flatMap((s) => wideBorders(s.text).map((m) => `${s.name}: ${m}`))).toEqual([]);
  });

  it('테두리 검사가 실제로 잡는다 — 같은 함수(wideBorders)에 표본을 넣어 본다', () => {
    // 정규식이 조용히 아무것도 못 잡는 회귀를 막는다
    const samples = [
      'className="border-2"',
      'className="border-l-4 border-amber-500"',
      'className="border-[3px]"',
      'className="border-t-[0.25rem]"',
      "style={{ borderLeft: '4px solid #d97706' }}",
      'style={{ borderWidth: 2 }}',
      '.x { border-left: 3px solid red; }',
    ];
    const ok = [
      'className="border border-line"',
      'className="border-r border-0 border-slate-300 border-[1px]"',
      "style={{ borderColor: '#2563eb40', borderWidth: 1 }}",
      'itemStyle: { borderWidth: 2 }',
    ];
    expect(samples.filter((t) => wideBorders(t).length === 0)).toEqual([]);
    expect(ok.flatMap(wideBorders)).toEqual([]);
  });
});
