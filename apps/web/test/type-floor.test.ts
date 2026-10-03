// 글자 바닥 — 화면 안 최소 12px · 글자 단계 12 · 13 · 14 · 16 · 20 · 28만(.omc/plans/web-ux-polish.md §2.1 · §3)
// 대상: 성능 비교 · 모니터링(components/experiments/flow — §7.1 R14) · 셸 · 실행 패널 · 공통 조각 · app. 흐름도 SVG 배율을 곱한 실제 크기는 test/flow-layout이 따로 본다.
// ① 소스 — 임의 px 글자 크기(text-[11px] 등) · 단계 밖 Tailwind 크기(text-lg · text-2xl …) · 12 미만 fontSize(SVG · 캔버스 옵션) 금지 ·
//    1px 넘는 테두리(Tailwind 단계 border-2 · border-l-4 · 임의 값 border-[3px] · 인라인 style borderWidth · borderLeft: '4px …' · CSS border: 2px) 금지(craft floor)
// ② 그림 2 차트 옵션 — 실제로 내려가는 모든 fontSize가 12 이상(캔버스는 CSS 배율이 없어 옵션 값이 곧 화면 px)
// ③ 왜? ① 그림 SVG — viewBox가 실제 픽셀과 1:1이라 fontSize 12가 화면에서도 12px
// ④ 넓고 높은 화면 변형(perf/roomy.ts — 가로 ≥ 1680 · 세로 ≥ 1000) — 글자는 단계 안에서 한 단계씩만 커진다(§9 P1)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { curveOption } from '../components/experiments/perf/options';
import { ROOMY, ROOMY_MEDIA } from '../components/experiments/perf/roomy';
import { curveLines, findRange, readPerf } from '../lib/perf';

const ROOT = path.resolve(__dirname, '..');
const TARGETS = [
  'components/experiments/perf',
  'components/experiments/flow',
  'components/experiments/echart.tsx',
  'components/experiments/evidence.tsx',
  'components/shell',
  'components/runs',
  'components/ui',
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
        'components/experiments/perf/sensor-column.tsx',
        'components/experiments/perf/business-column.tsx',
        'components/experiments/flow/flow-screen.tsx',
        'components/experiments/flow/flow-diagram.tsx',
        'components/shell/sidebar.tsx',
        'components/runs/run-progress.tsx',
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

describe('글자 바닥 — 그림 2 차트 옵션(실제 값)', () => {
  const DIR = path.join(__dirname, 'fixtures', 'real');
  const view = readPerf(
    readdirSync(DIR)
      .filter((n) => n.endsWith('.md'))
      .map((name) => ({ name, text: readFileSync(path.join(DIR, name), 'utf8') })),
  );

  /** 옵션 트리 안 모든 fontSize */
  function sizes(o: unknown, out: number[] = []): number[] {
    if (Array.isArray(o)) for (const x of o) sizes(x, out);
    else if (o && typeof o === 'object')
      for (const [k, v] of Object.entries(o)) {
        if (k === 'fontSize' && typeof v === 'number') out.push(v);
        else sizes(v, out);
      }
    return out;
  }

  it('범례(모양 범례 — 속 빈 점 · 삼각형 항목 포함) · 축 이름 · 눈금 · 역전 표지 모두 12px 이상 · 축 이름에 "눈금마다 10배"', () => {
    // 10^8 점 하나를 결과 불일치로(메모리에서만) — 삼각형 범례까지 그려지게
    const lines = curveLines(view.points, 'Q2', 'warm')
      .filter((l) => l.key !== 'I1')
      .map((l) => ({
        ...l,
        points: l.points.map((p) => (Math.abs(p.exponent - 8) < 1e-6 ? { ...p, resultMatch: false } : p)),
      }));
    const opt = curveOption({
      lines,
      range: findRange(view.ranges, 'Q2', 'warm', 'I2'),
      live: { ch: [], pg: [] },
      undetermined: [7],
    }) as unknown as {
      yAxis: { name: string };
      legend: { left?: number; right?: number; top: number; data: unknown[] }[];
    };
    const all = sizes(opt);
    expect(all.length).toBeGreaterThanOrEqual(6);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(12);
    expect(opt.yAxis.name).toBe('걸린 시간(밀리초) · 눈금마다 10배');
    // 색 범례는 그림 위 왼쪽(기준선과 겹치지 않게 — 세로 축 이름은 그 아래 줄) · 모양 범례는 둘째 줄 오른쪽
    expect(opt.legend[0]).toMatchObject({ left: 0, top: 0 });
    expect(opt.legend[1]).toMatchObject({ right: 0, top: 17 });
    expect(opt.legend[1]?.data).toHaveLength(2);
  });
});

describe('글자 바닥 — 왜? ① 그림 SVG는 1:1', () => {
  it('width · height가 viewBox 크기와 같다(배율 1 — fontSize 12 = 화면 12px)', () => {
    const src = SOURCES.find((s) => s.name.endsWith('sensor-column.tsx'))?.text ?? '';
    const m = /width=\{(\d+)\}\s+height=\{(\d+)\}\s+viewBox="0 0 (\d+) (\d+)"/.exec(src);
    expect(m).not.toBeNull();
    if (!m) return;
    expect([m[1], m[2]]).toEqual([m[3], m[4]]);
  });
});

describe('글자 바닥 — 넓고 높은 화면 변형(성능 비교 두 구역 · §9 P1)', () => {
  const STEPS = ['text-xs', 'text-label', 'text-sm', 'text-base', 'text-xl', 'text-answer'];
  const PREFIX = '[@media(min-width:1680px)_and_(min-height:1000px)]:';

  it('미디어는 가로 1680 그리고 세로 1000 하나 — 모든 변형 클래스가 같은 머리로 시작한다(1440 × 900 · 1280 × 800은 꺼짐)', () => {
    expect(ROOMY_MEDIA).toBe('(min-width:1680px) and (min-height:1000px)');
    expect(PREFIX.slice(7, -2).replaceAll('_', ' ')).toBe(ROOMY_MEDIA);
    for (const [k, c] of Object.entries(ROOMY)) expect(c.startsWith(PREFIX), k).toBe(true);
    // 성능 비교 소스의 미디어 변형은 roomy.ts 밖에 직접 적지 않는다(조건이 한곳에서만 바뀐다)
    const outside = SOURCES.filter((s) => s.name.startsWith('components/experiments/perf/'))
      .filter((s) => !s.name.endsWith('roomy.ts'))
      .flatMap((s) => [...s.text.matchAll(/\[@media/g)].map(() => s.name));
    expect(outside).toEqual([]);
  });

  it('글자 클래스는 단계 안에서 바로 한 단계 위 — 12 → 13 · 13 → 14 · 14 → 16 · 16 → 20', () => {
    const pairs = { xs: 'text-xs', label: 'text-label', sm: 'text-sm', base: 'text-base' } as const;
    for (const [k, from] of Object.entries(pairs)) {
      const to = ROOMY[k as keyof typeof pairs].slice(PREFIX.length);
      expect(STEPS.indexOf(to), `${from} → ${to}`).toBe(STEPS.indexOf(from) + 1);
    }
    // 그 밖의 변형은 글자 크기를 바꾸지 않는다(높이 · 폭 · 틈만)
    const others = Object.entries(ROOMY).filter(([k]) => !(k in pairs));
    for (const [k, c] of others) expect(c.slice(PREFIX.length).startsWith('text-'), k).toBe(false);
  });
});
