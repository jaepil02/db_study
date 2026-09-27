// 구조 판정 역전 구간 — 08_screen/07 §대조군 역전 지점(계약 "구조 판정 역전 구간" · "구조 판정 원천 선택" · "구조 판정 한계").
// 픽스처는 053 모양의 기록(discarded · structuralRanges)과 원천이 되지 않는 기록들이다. 수치는 형식 예시이며 측정값이 아니다.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  conditionText,
  STRUCTURAL_LIMIT,
  StructuralRangesTable,
} from '../components/experiments/structural-ranges';
import {
  formatCrossover,
  formatExpRange,
  readMeasurements,
  type StructuralSource,
} from '../lib/measurements';

const DIR = path.join(__dirname, 'fixtures/structural');
const load = (names?: string[]) =>
  readdirSync(DIR)
    .filter((n) => !names || names.includes(n))
    .map((name) => ({ name, text: readFileSync(path.join(DIR, name), 'utf8') }));

describe('구조 판정 원천 선택', () => {
  it('EXP-01~05 · structuralRanges · 4요소 완비 기록 가운데 번호가 가장 큰 053을 읽는다(054 비대조 · 055 4요소 누락 · 056 필드 없음 · 057 · 058 superseded · 060 배열 아님은 빠진다)', () => {
    const r = readMeasurements(load());
    expect(r.structural?.record).toBe('053');
    expect(r.structural?.status).toBe('discarded');
    // memoryLimitMb null은 memoryLimitSource로 충족
    expect(r.structural?.run.memoryLimitMb).toBeNull();
    expect(r.structural?.run.memoryLimitSource).toMatch(/^cgroup max/);
  });

  it('superseded는 원천에서 뺀다 — status superseded(057) · 다른 valid 기록의 supersedes 대상(058 ← 059)', () => {
    const only = (names: string[]) => readMeasurements(load(names)).structural?.record ?? null;
    expect(only(['049-control-refine-old.md', '057-control-superseded-status.md'])).toBe('049');
    expect(only(['049-control-refine-old.md', '058-control-superseded-target.md'])).toBe('058'); // 정정 기록이 없으면 원천이다
    expect(
      only(['049-control-refine-old.md', '058-control-superseded-target.md', '059-control-corrects-058.md']),
    ).toBe('049');
  });

  it('structuralRanges가 배열이 아닌 대조 기록은 원천 후보가 아니고 형식 위반으로 센다', () => {
    const r = readMeasurements(load());
    expect(r.counts.invalidStructural).toBe(1);
    expect(readMeasurements(load(['060-control-ranges-not-array.md'])).structural).toBeNull();
    expect(readMeasurements(load(['053-control-refine.md'])).counts.invalidStructural).toBe(0);
  });

  it('폐기 기록의 시간 점은 여전히 그리지 않는다', () => {
    const r = readMeasurements(load());
    expect(r.points).toHaveLength(0);
    expect(r.counts.excludedStatus).toBeGreaterThan(0);
  });

  it('053이 없으면 다음으로 큰 049를 읽고, 후보가 없으면 null', () => {
    expect(
      readMeasurements(load(['049-control-refine-old.md', '056-control-no-ranges.md'])).structural?.record,
    ).toBe('049');
    expect(readMeasurements(load(['054-alarm-branch.md', '056-control-no-ranges.md'])).structural).toBeNull();
  });

  it('행 판독 — 역전 구간 · 역전 없음(앞선 쪽 · 범위) · 우열 미정 점 · 형식이 어긋난 행은 빼고 센다', () => {
    const s = readMeasurements(load()).structural as StructuralSource;
    expect(s.ranges).toHaveLength(4);
    // winner "mysql" · 지수 표기 위반 "1e7" · crossover가 있는데 winner · range를 함께 실은 행
    expect(s.invalidRanges).toBe(3);
    expect(s.ranges[0]).toEqual({
      query: 'Q1',
      cache: 'warm',
      pgVariant: 'I2',
      crossover: null,
      winner: 'postgresql',
      range: ['10^5', '10^9'],
      undetermined: [],
    });
    expect(s.ranges[1]).toMatchObject({
      query: 'Q1',
      cache: 'cold',
      crossover: ['10^7', '10^7.25'],
      direction: null,
    });
    expect(s.ranges[2]).toMatchObject({
      undetermined: ['10^8'],
      direction: { from: 'postgresql', to: 'clickhouse' },
    });
    expect(formatCrossover(['10^7', '10^7.25'])).toBe('(10^7, 10^7.25]행');
    expect(formatExpRange(['10^5', '10^9'])).toBe('10^5 ~ 10^9행');
  });

  it('실제 docs/measurements/053의 structuralRanges 20행을 형식 위반 없이 읽는다', () => {
    const real = path.resolve(__dirname, '../../../docs/measurements/053-control-refine.md');
    if (!existsSync(real)) return;
    const r = readMeasurements([{ name: '053-control-refine.md', text: readFileSync(real, 'utf8') }]);
    expect(r.structural?.record).toBe('053');
    expect(r.structural?.ranges).toHaveLength(20);
    expect(r.structural?.invalidRanges).toBe(0);
  });
});

describe('구조 판정 역전 구간 표 렌더', () => {
  const s = readMeasurements(load()).structural as StructuralSource;
  const html = renderToStaticMarkup(createElement(StructuralRangesTable, { source: s }));

  it('열 5 · 행마다 역전 구간 또는 "역전 없음 — 앞선 쪽 · 범위" · 우열 미정 점', () => {
    for (const h of ['쿼리', '캐시', 'PG 변형', '역전 구간', '우열 미정 점'])
      expect(html).toContain(`>${h}</th>`);
    expect(html).toContain('>(10^7, 10^7.25]행</span>');
    expect(html).toContain('(10^7.5, 10^8.25]행 · PostgreSQL 대조군 → ClickHouse');
    expect(html).toContain('>Q1 단일 태그 1시간 (EXP-01)</td>');
    expect(html).toContain('역전 없음 — PostgreSQL 대조군 앞섬 · 10^5 ~ 10^9행');
    expect(html).toContain('역전 없음 — ClickHouse 앞섬 · 10^5.5 ~ 10^9행');
    expect(html).toContain('>10^8</td>');
    expect((html.match(/<tr /g) ?? []).length).toBe(4);
  });

  it('근거 표지 · 원천 기록 번호 · 4요소 툴팁 · 한계 문구 · 형식이 어긋난 행 수', () => {
    expect(html).toContain(
      'discarded 기록의 구조 사실 — 반복 3회 우열 일치(04 §구조 판정) · 크기 수치는 인용하지 않는다',
    );
    expect(html).toContain('원천 기록 053');
    const tip = conditionText(s);
    expect(tip).toContain('커밋 c89b982');
    expect(tip).toContain('cgroup max');
    expect(tip).toContain('SW-11=ingest');
    expect(html).toContain('client만 쓰면 콜드 구간이 달라진다');
    expect(html).toContain('형식이 어긋난 행 3');
  });

  it('형식이 어긋난 행은 0이어도 보인다', () => {
    const clean = readMeasurements(load(['049-control-refine-old.md'])).structural as StructuralSource;
    expect(renderToStaticMarkup(createElement(StructuralRangesTable, { source: clean }))).toContain(
      '형식이 어긋난 행 0',
    );
  });

  it('쿼리 시간 값은 싣지 않는다 — ms 수치는 한계 문구의 동률 규칙 문턱뿐이다', () => {
    expect(html.replace(STRUCTURAL_LIMIT, '')).not.toMatch(/\d\s*(ms|µs)/);
  });
});
