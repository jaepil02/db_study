// EXP-PERF 판독기 — 08_screen/08_evidence_screens.md §EXP-PERF §데이터 원천 · §판독 규칙 P1~P6 · §표시 계약.
// 원천은 실제 격자 기록 048~053(docs/measurements · 읽기만 한다). 변형이 필요한 경우만 본문을 메모리에서 고쳐 넣는다 — 파일은 건드리지 않는다.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { init, use } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../components/experiments/echart';
import { curveOption, heatmapOption } from '../components/experiments/perf/options';
import {
  ConclusionCard,
  CountsLine,
  curveHeadline,
  EMPTY_SOURCE,
  LIMIT_MARKS,
  PrincipleTable,
  REFERENCE_BADGE,
  rangeSentence,
  StorageTable,
} from '../components/experiments/perf/panels';
import { PerfScreen } from '../components/experiments/perf/perf-screen';
import {
  compactNodes,
  curveLines,
  exponentOf,
  findRange,
  heatCells,
  PERF_QUERIES,
  type PerfView,
  parsePerfParams,
  postgresLeads,
  readPerf,
  undeterminedMarks,
  verdictFromRange,
} from '../lib/perf';

use([SVGRenderer]);

const DIR = path.resolve(__dirname, '../../../docs/measurements');
const NAMES = [
  '048-control-stage-1.md',
  '049-control-stage-2.md',
  '050-control-stage-3.md',
  '051-control-stage-4.md',
  '052-control-stage-5.md',
  '053-control-refine.md',
];
const real = NAMES.map((name) => ({ name, text: readFileSync(path.join(DIR, name), 'utf8') }));
const v = readPerf(real);

/** 기록 본문의 기계 판독 블록을 고쳐 새 파일로 — 원본은 그대로 */
function patch(name: string, newName: string, f: (b: Record<string, unknown>) => void) {
  const text = real.find((x) => x.name === name)?.text ?? '';
  const re = /^```json[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm;
  let out = text;
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const b = JSON.parse(m[1] ?? '') as Record<string, unknown>;
    if (b.schema !== 'measurement/v1') continue;
    f(b);
    out = text.replace(m[1] ?? '', `${JSON.stringify(b, null, 2)}\n`);
  }
  return { name: newName, text: out };
}
const cond = (b: Record<string, unknown>) => b.conditions as Record<string, unknown>;

describe('P1 · P2 — 원천 기록 · 단계 기록', () => {
  it('원천은 053(구조 판정 원천과 같은 하나) · discarded · 단계 기록 048~052 전부 더한다', () => {
    expect(v.source?.record).toBe('053');
    expect(v.source?.status).toBe('discarded');
    expect(v.stageRecords).toEqual([
      { stage: 1, record: '048', excluded: null },
      { stage: 2, record: '049', excluded: null },
      { stage: 3, record: '050', excluded: null },
      { stage: 4, record: '051', excluded: null },
      { stage: 5, record: '052', excluded: null },
    ]);
    expect(v.records.map((r) => r.record)).toEqual(['048', '049', '050', '051', '052', '053']);
    expect(v.ranges).toHaveLength(20);
    expect(v.counts).toMatchObject({ unreadable: 0, missingConditions: 0, invalidRanges: 0, invalidRows: 0 });
  });

  it('053 정밀화 180점 + 단계 30점 × 5 = 330점 · 점 11(단계 5 + 정밀화 6)', () => {
    expect(v.points.filter((p) => p.record === '053')).toHaveLength(180);
    for (const r of ['048', '049', '050', '051', '052'])
      expect(v.points.filter((p) => p.record === r)).toHaveLength(30);
    expect(v.points).toHaveLength(330);
    expect(heatCells(v, 'warm', 'I2').exponents).toEqual([5, 5.5, 5.75, 6, 7, 7.25, 7.5, 8, 8.25, 8.5, 9]);
  });

  it('단계 기록 목록이 없으면 원천 기록의 점만 · 원리 증거 · 저장 비용은 비고 계수 줄에 "단계 기록 목록 없음"', () => {
    const noList = patch('053-control-refine.md', '053-control-refine.md', (b) => {
      delete cond(b).stageRecords;
    });
    const r = readPerf([...real.slice(0, 5), noList]);
    expect(r.stageRecords).toBeNull();
    expect(r.points).toHaveLength(180);
    expect(r.scan).toEqual([]);
    expect(r.storage).toEqual([]);
    expect(renderToStaticMarkup(createElement(CountsLine, { view: r, yLog: true }))).toContain(
      '단계 기록 목록 없음',
    );
  });

  it('목록의 기록이 없거나 superseded · 4요소 누락이면 빼고 센다', () => {
    const src = patch('053-control-refine.md', '053-control-refine.md', (b) => {
      cond(b).stageRecords = { '1': '048', '2': '049', '3': '050', '4': '099' };
    });
    const sup = patch('049-control-stage-2.md', '049-control-stage-2.md', (b) => {
      b.status = 'superseded';
    });
    const miss = patch('050-control-stage-3.md', '050-control-stage-3.md', (b) => {
      (b.run as Record<string, unknown>).commitHash = null;
    });
    const r = readPerf([real[0] as { name: string; text: string }, sup, miss, src]);
    expect(r.stageRecords?.map((s) => s.excluded)).toEqual([
      null,
      'superseded',
      'missing-conditions',
      'absent',
    ]);
    expect(r.counts.missingConditions).toBe(1);
    expect(r.records.map((x) => x.record)).toEqual(['048', '053']);
    const line = renderToStaticMarkup(createElement(CountsLine, { view: r, yLog: true }));
    expect(line).toContain('099(파일 없음 — 뺌)');
    expect(line).toContain('049(superseded — 뺌)');
  });

  it('원천 기록이 없으면 빈 보기(빈 값 ①) · 계수 줄은 남는다', () => {
    const r = readPerf(real.slice(0, 5));
    expect(r.source).toBeNull();
    expect(r.points).toEqual([]);
    expect(r.counts.files).toBe(5);
  });
});

describe('기록별 필드 이름 정규화', () => {
  const at = (record: string, rows: number, store: string, index: string | null, cache: string, q = 'Q1') =>
    v.points.find(
      (p) =>
        p.record === record &&
        p.rows === rows &&
        p.store === store &&
        p.index === index &&
        p.cache === cache &&
        p.query === q,
    );
  it('048~050 server.* · judgment.* / 051 · 052 serverValues · deviationBasis / 053 judgmentBasis를 한 모양으로', () => {
    const a = at('048', 1e5, 'clickhouse', null, 'cold');
    expect(a).toMatchObject({ serverMedian: 2.165, serverValues: [2.209, 2.115, 2.165], basis: 'server' });
    expect(a?.deviation).toBeCloseTo(0.043418);
    const b = at('052', 1e9, 'clickhouse', null, 'cold');
    expect(b).toMatchObject({ serverMedian: 4.428, basis: 'server', deviation: 0.0454, resultMatch: true });
    const c = at('053', 320000, 'clickhouse', null, 'warm');
    expect(c).toMatchObject({ point: 'r5.5', serverMedian: 2.277, basis: 'server', exponent: 5.5 });
  });

  it('행 수 → 지수는 log10을 0.25 단위로(17,780,000 → 10^7.25)', () => {
    expect(exponentOf(17_780_000)).toBe(7.25);
    expect(exponentOf(316_000_000)).toBe(8.5);
    expect(exponentOf(560_000)).toBe(5.75);
  });
});

describe('P3 · P6 — 참고값 표지 · 그리지 않은 점', () => {
  it('048~053 전부 discarded — 참고값 배지 대상 · 편차 기준을 넘는 점이 있다', () => {
    expect(v.discardedRecords).toEqual(NAMES.map((n) => n.slice(0, 3)));
    expect(v.points.some((p) => p.deviation !== null && p.deviation > p.threshold)).toBe(true);
  });

  it('median null · unit ms 아님은 그리지 않고 센다 · 0 이하는 로그 축에서만 센다 · Q5x는 곡선에 없다', () => {
    const bad = patch('052-control-stage-5.md', '052-control-stage-5.md', (b) => {
      const ps = b.points as Record<string, unknown>[];
      (ps[0] as Record<string, unknown>).median = null;
      (ps[1] as Record<string, unknown>).unit = 's';
      (ps[2] as Record<string, unknown>).median = 0;
    });
    const r = readPerf([...real.slice(0, 4), bad, real[5] as { name: string; text: string }]);
    expect(r.counts.undrawn).toBe(2);
    expect(r.counts.nonPositive).toBe(1);
    expect(renderToStaticMarkup(createElement(CountsLine, { view: r, yLog: true }))).toContain(
      '그리지 않은 점 3',
    );
    expect(renderToStaticMarkup(createElement(CountsLine, { view: r, yLog: false }))).toContain(
      '그리지 않은 점 2',
    );
    expect(renderToStaticMarkup(createElement(CountsLine, { view: v, yLog: true }))).toContain(
      '그리지 않은 점 0',
    );
    expect(v.points.some((p) => p.query === 'Q5x')).toBe(false);
  });

  it('P5 — 같은 점이 두 기록에 있으면 번호가 큰 기록', () => {
    const copy = patch('048-control-stage-1.md', '060-control-stage-1-remeasure.md', (b) => {
      b.record = '060';
    });
    const src = patch('053-control-refine.md', '053-control-refine.md', (b) => {
      cond(b).stageRecords = { '1': '048', '6': '060' };
    });
    const r = readPerf([real[0] as { name: string; text: string }, copy, src]);
    expect(r.counts.duplicatePoints).toBe(30);
    expect(r.points.filter((p) => p.rows === 1e5).every((p) => p.record === '060')).toBe(true);
  });
});

describe('P4 — 점 단위 우열', () => {
  const verdict = (q: string, cache: string, pgVariant: string, e: number) =>
    v.verdicts.find(
      (x) => x.query === q && x.cache === cache && x.pgVariant === pgVariant && x.exponent === e,
    )?.verdict;
  it('048~050 dominance("CH" · "PG" → 저장소 값 · unanimous false면 미정)', () => {
    expect(verdict('Q1', 'cold', 'I1', 5)).toBe('clickhouse');
    expect(verdict('Q1', 'cold', 'I2', 5)).toBe('postgresql');
    expect(verdict('Q5', 'warm', 'I1', 5)).toBe('undetermined');
  });
  it('051 · 052 pairVerdicts structuralWinner', () => {
    expect(verdict('Q1', 'warm', 'I2', 9)).toBe('postgresql');
    expect(verdict('Q1', 'cold', 'I2', 9)).toBe('clickhouse');
  });
  it('053 정밀화 점은 structuralRanges에서 — a 이하 from · b 이상 to · undetermined 미정 · 방향은 crossovers에서', () => {
    expect(verdict('Q2', 'warm', 'I2', 7.5)).toBe('postgresql');
    expect(verdict('Q2', 'warm', 'I2', 8.25)).toBe('clickhouse');
    expect(verdict('Q3', 'cold', 'I2', 5.75)).toBe('undetermined');
    expect(verdict('Q1', 'warm', 'I2', 8.5)).toBe('postgresql');
    // 053 정밀화 6점 × 20행 + 단계 20 × 5
    expect(v.verdicts).toHaveLength(220);
  });
  it('방향을 찾지 못하면 방향 미상(빗금 자리)', () => {
    const r = findRange(v.ranges, 'Q2', 'warm', 'I2');
    expect(r?.crossover).toEqual(['10^7.5', '10^8.25']);
    expect(r && r.crossover !== null ? r.direction : 'x').toEqual({ from: 'postgresql', to: 'clickhouse' });
    if (r && r.crossover !== null)
      expect(verdictFromRange({ ...r, direction: null }, 8.5)).toBe('unknown-direction');
  });
});

describe('표시 계약 — 역전 음영 · 우열 미정 · 결론 카드', () => {
  it('structuralRanges I2 행의 (10^a, 10^b] 음영 · 방향 표지 · 곡선 교차가 아니라 구조 판정', () => {
    const opt = curveOption({
      lines: curveLines(v.points, 'Q2', 'warm'),
      i2Range: findRange(v.ranges, 'Q2', 'warm', 'I2'),
      undetermined: undeterminedMarks(v, 'Q2', 'warm'),
      records: v.records,
      yLog: true,
    }) as unknown as { series: { id: string; markArea?: { data: { xAxis: number; name?: string }[][] } }[] };
    const area = opt.series.find((s) => s.id === 'line-I2')?.markArea?.data[0];
    expect(area?.[0]?.xAxis).toBeCloseTo(10 ** 7.5);
    expect(area?.[1]?.xAxis).toBeCloseTo(10 ** 8.25);
    expect(area?.[0]?.name).toBe('역전 구간 I2 → ClickHouse');
    // I1 · ClickHouse 선에는 음영이 없다(I1 행은 결론 카드에만)
    expect(opt.series.filter((s) => s.markArea)).toHaveLength(1);
    expect(curveHeadline(findRange(v.ranges, 'Q2', 'warm', 'I2'))).toContain(
      '(10^7.5, 10^8.25]행 PostgreSQL I2 → ClickHouse',
    );
    expect(curveHeadline(findRange(v.ranges, 'Q1', 'warm', 'I2'))).toBe(
      '관측 범위 10^5~10^9 역전 없음 — 앞선 쪽 PostgreSQL I2',
    );
  });

  it('곡선 · 히트맵 옵션이 실제로 그려진다(SVG 서버 렌더)', () => {
    const c = init(null as unknown as HTMLElement, undefined, {
      renderer: 'svg',
      ssr: true,
      width: 900,
      height: 400,
    });
    c.setOption(
      curveOption({
        lines: curveLines(v.points, 'Q3', 'cold'),
        i2Range: findRange(v.ranges, 'Q3', 'cold', 'I2'),
        undetermined: undeterminedMarks(v, 'Q3', 'cold'),
        records: v.records,
        yLog: true,
      }) as never,
    );
    expect(c.renderToSVGString()).toContain('역전 구간 I2 → ClickHouse');
    const h = init(null as unknown as HTMLElement, undefined, {
      renderer: 'svg',
      ssr: true,
      width: 600,
      height: 400,
    });
    const hc = heatCells(v, 'warm', 'I2');
    h.setOption(heatmapOption(hc.exponents, hc.cells, PERF_QUERIES, 'I2') as never);
    expect(h.renderToSVGString()).toContain('1.0× ?'); // Q2 웜 10^8 — 우열 미정
    c.dispose();
    h.dispose();
  });

  it('우열 미정 — undetermined 점과 P4 미정 점 · 결론 카드 "우열 미정 10^8 웜"', () => {
    expect(undeterminedMarks(v, 'Q2', 'warm')).toEqual([{ exponent: 8, pgVariant: 'I2' }]);
    expect(undeterminedMarks(v, 'Q5', 'warm')).toEqual([
      { exponent: 5, pgVariant: 'I1' },
      { exponent: 5, pgVariant: 'I2' },
    ]);
    const html = renderToStaticMarkup(createElement(ConclusionCard, { view: v, query: 'Q2', cache: 'warm' }));
    expect(html).toContain('우열 미정 </span>10^8 웜(I2)');
    expect(html).toContain('(10^7.5, 10^8.25]행 PostgreSQL I2 → ClickHouse');
    expect(html).toContain('역전 없음 — ClickHouse 앞섬 · 10^5 ~ 10^9행');
  });

  it('결론 카드 "PostgreSQL이 앞서는 경우" — Q1 웜 I2 10^9까지 · 역전 전 구간', () => {
    const leads = postgresLeads(v.ranges, 5);
    expect(leads).toContainEqual({
      query: 'Q1',
      cache: 'warm',
      pgVariant: 'I2',
      span: ['10^5', '10^9'],
      kind: 'no-crossover',
    });
    expect(leads).toContainEqual({
      query: 'Q3',
      cache: 'cold',
      pgVariant: 'I2',
      span: ['10^5', '10^5.5'],
      kind: 'before-crossover',
    });
    expect(leads).toHaveLength(6);
    const html = renderToStaticMarkup(createElement(ConclusionCard, { view: v, query: 'Q4', cache: 'cold' }));
    expect(html).toContain('PostgreSQL이 앞서는 경우');
    expect(html).toContain('Q1 웜 I2 — 10^5 ~ 10^9행(역전 없음)');
  });

  it('행 문장 — 역전 없음 · 앞선 쪽 · 범위', () => {
    const r = findRange(v.ranges, 'Q5', 'warm', 'I1');
    expect(r && rangeSentence(r)).toBe('역전 없음 — ClickHouse 앞섬 · 10^5.5 ~ 10^9행');
  });
});

describe('원리 증거 · 저장 비용 — 결정적 값 · 구조 사실', () => {
  it('원리 증거는 단계 5점 · Q5x 제외 · 힙 블록 = 같은 기록 Q5 I1 hit + read · Q3 I2 10^9 128.2%(방문 횟수)', () => {
    expect(v.scan.map((s) => s.record)).toEqual(['048', '049', '050', '051', '052']);
    const s9 = v.scan.find((s) => s.exponent === 9);
    expect(s9?.heapBlocks).toBe(9_345_856);
    expect(s9?.queries.map((q) => q.query)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
    expect(s9?.queries.find((q) => q.query === 'Q3')?.pg.I2?.bufferRatio).toBeCloseTo(1.2823, 4);
    expect(s9?.queries.find((q) => q.query === 'Q5')?.ch?.readBytesRatio).toBeCloseTo(8e9 / (1e9 * 41));
    // 계획 노드는 051 · 052만
    expect(v.scan.find((s) => s.exponent === 5)?.queries[0]?.pg.I1?.nodes).toBeNull();
    const html = renderToStaticMarkup(createElement(PrincipleTable, { view: v, exponent: 5 }));
    expect(html).toContain('계획 노드 기록 없음');
    expect(html).toContain('구조 사실 · 기록 048 · discarded');
    expect(renderToStaticMarkup(createElement(PrincipleTable, { view: v, exponent: 9 }))).toContain('128.2%');
  });

  it('저장 비용 — 단계 5행 · 행당 바이트 = storage_bytes ÷ rows · WAL은 증폭 비율만 · 바이트는 051 · 052 buildWalBytes만', () => {
    expect(v.storage.map((s) => s.record)).toEqual(['048', '049', '050', '051', '052']);
    const s9 = v.storage.find((s) => s.exponent === 9);
    expect(s9?.perRowBytes.pg).toBeCloseTo(76584214528 / 1e9);
    expect(s9?.walAmplification).toBe(1.8571);
    expect(s9?.btreeBuildWalBytes).toBe(10_211_835_636);
    expect(v.storage.map((s) => s.btreeBuildWalBytes)).toEqual([
      null,
      null,
      null,
      1_020_762_514,
      10_211_835_636,
    ]);
    const html = renderToStaticMarkup(createElement(StorageTable, { view: v }));
    expect(html).toContain('결정적 값 · 기록 052 · discarded');
    expect(html).not.toContain(REFERENCE_BADGE);
  });

  it('compactNodes — 이어지는 같은 노드를 묶는다', () => {
    expect(compactNodes(['Aggregate', 'Seq Scan', 'Seq Scan', 'Seq Scan'])).toBe('Aggregate › Seq Scan ×3');
  });
});

describe('화면 — 상태 4행 · 딥링크', () => {
  const render = (data: (PerfView & { readAt: number }) | undefined, query = 'Q2', cache = 'warm') => {
    const client = new QueryClient();
    if (data) client.setQueryData(['measurements', 'perf'], data);
    return renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(PerfScreen, { initialQuery: query, initialCache: cache }),
      ),
    );
  };

  it('정상 — 참고값 배지 한 자리 · 원천 기록 053(+048~052) · 한계 표지 3 · 계수 줄 "관찰 보조"', () => {
    const html = render({ ...v, readAt: Date.UTC(2026, 8, 28, 1, 15, 3, 120) });
    expect(html.split(REFERENCE_BADGE)).toHaveLength(2);
    expect(html).toContain('053(+048 · 049 · 050 · 051 · 052)');
    expect(html).toContain('2026-09-28 10:15:03.120 KST');
    for (const m of LIMIT_MARKS) expect(html).toContain(m.slice(0, 12));
    expect(html).toContain('관찰 보조 — 기록 정본 아님');
    expect(html).not.toContain('<h1');
  });

  it('빈 값 ① — 원천 기록 없음 문구 · 계수 줄은 보인다', () => {
    const html = render({ ...readPerf([]), readAt: 0 });
    expect(html).toContain(EMPTY_SOURCE);
    expect(html).toContain('원천 기록 없음');
    expect(html).not.toContain(REFERENCE_BADGE);
  });

  it('빈 값 ③ — 선택 쿼리 · 캐시의 structuralRanges 행 없음', () => {
    const r = { ...v, ranges: v.ranges.filter((x) => x.query !== 'Q4'), readAt: 0 };
    expect(render(r, 'Q4', 'cold')).toContain('이 쿼리 · 캐시의 구조 판정 행이 없다');
  });

  it('로딩 — 응답 전에도 툴바 · 계수 줄 자리를 그린다', () => {
    const html = render(undefined);
    expect(html).toContain('새로고침');
    expect(html).toContain('판독 전');
  });

  it('딥링크 q · cache — 벗어난 값은 기본 Q2 · warm', () => {
    expect(parsePerfParams({ q: 'Q4', cache: 'cold' })).toEqual({ query: 'Q4', cache: 'cold' });
    expect(parsePerfParams({})).toEqual({ query: 'Q2', cache: 'warm' });
    expect(parsePerfParams({ q: 'Q9', cache: ['hot'] })).toEqual({ query: 'Q2', cache: 'warm' });
  });
});

describe('BFF view=perf', () => {
  it('같은 라우트가 view=perf면 성능 보기를 no-store로 내린다 · 없으면 기존 역전 지점 판독 그대로', async () => {
    process.env.MEASUREMENTS_DIR = DIR;
    const { GET } = await import('../app/bff/measurements/route');
    const perf = await GET(new Request('http://localhost/bff/measurements?view=perf'));
    expect(perf.headers.get('cache-control')).toBe('no-store');
    const body = (await perf.json()) as PerfView & { readAt: number };
    expect(body.source?.record).toBe('053');
    expect(body.points).toHaveLength(330);
    expect(typeof body.readAt).toBe('number');
    const base = (await (await GET(new Request('http://localhost/bff/measurements'))).json()) as Record<
      string,
      unknown
    >;
    expect(base).toHaveProperty('structural');
    expect(base).toHaveProperty('evidence');
    expect(base).not.toHaveProperty('verdicts');
    delete process.env.MEASUREMENTS_DIR;
  });
});
