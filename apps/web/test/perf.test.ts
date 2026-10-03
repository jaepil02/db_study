// EXP-PERF 판독기 · 한 장 화면 — 08_screen/08_evidence_screens.md §EXP-PERF §데이터 원천 · §판독 규칙 P1~P6 · 설계 .omc/plans/web-junior-redesign.md §2.
// 원천은 실제 격자 기록 048~053(docs/measurements · 읽기만 한다). 변형이 필요한 경우만 본문을 메모리에서 고쳐 넣는다 — 파일은 건드리지 않는다.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { init, use } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import '../components/experiments/echart';
import { BusinessColumn } from '../components/experiments/perf/business-column';
import {
  CROSS_LABEL,
  curveOption,
  HOLLOW_NAME,
  LEGEND_INK,
  LIVE_NAME,
  MISMATCH_TIP,
  rowsTick,
  TRIANGLE_NAME,
  UNDETERMINED_TIP,
  Y_AXIS_NAME,
} from '../components/experiments/perf/options';
import {
  PERF_FOOTNOTE,
  PERF_SUMMARY,
  PERF_TITLE,
  PerfScreen,
} from '../components/experiments/perf/perf-screen';
import { ROOMY, ROOMY_MEDIA } from '../components/experiments/perf/roomy';
import { barWidth, SensorColumn } from '../components/experiments/perf/sensor-column';
import { RunProvider } from '../components/runs/run-context';
import { readEvidence } from '../lib/evidence';
import {
  crossSentence,
  curveLines,
  exponentOf,
  findRange,
  msText,
  type PerfView,
  parsePerfParams,
  rangeText,
  ratioPercent,
  readPerf,
  readShare,
  rowBytes,
  rowsWords,
  shareText,
  speedBars,
  timesText,
  topRatio,
  undeterminedExps,
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

/** Pretendard 400 글자 전진 폭(advance) — OTF cmap(형식 12) · hmtx만 읽는 최소 판독(그림 2 범례 폭 근거) */
function pretendardRegular(): (text: string, px: number) => number {
  const buf = readFileSync(
    path.resolve(__dirname, '../node_modules/pretendard/dist/public/static/Pretendard-Regular.otf'),
  );
  const u16 = (o: number) => buf.readUInt16BE(o);
  const u32 = (o: number) => buf.readUInt32BE(o);
  const table = new Map<string, number>();
  for (let i = 0; i < u16(4); i++)
    table.set(buf.toString('latin1', 12 + 16 * i, 16 + 16 * i), u32(20 + 16 * i));
  const at = (tag: string) => table.get(tag) ?? 0;
  const upm = u16(at('head') + 18);
  const metrics = u16(at('hhea') + 34);
  const advance = (g: number) => u16(at('hmtx') + 4 * Math.min(g, metrics - 1));
  const glyph = new Map<number, number>();
  const cm = at('cmap');
  for (let i = 0; i < u16(cm + 2); i++) {
    const sub = cm + u32(cm + 8 + 8 * i);
    if (u16(sub) !== 12) continue;
    for (let g = 0; g < u32(sub + 12); g++) {
      const [lo, hi, id] = [u32(sub + 16 + 12 * g), u32(sub + 20 + 12 * g), u32(sub + 24 + 12 * g)];
      for (let c = lo; c <= hi; c++) glyph.set(c, id + c - lo);
    }
  }
  return (text, px) =>
    ([...text].reduce((w, ch) => w + advance(glyph.get(ch.codePointAt(0) ?? 0) ?? 0), 0) * px) / upm;
}

/** 그림 2 범례 — 색 범례(첫 줄 왼쪽) · 모양 범례(둘째 줄 오른쪽 · 그 점이 있을 때만) */
type LegendItem = string | { name: string; itemStyle?: { color?: string } };
type Legend = { data: LegendItem[]; top: number; left?: number; right?: number; selectedMode?: boolean };
const itemName = (d: LegendItem) => (typeof d === 'string' ? d : d.name);
const legendNames = (o: unknown) =>
  ((o as { legend: Legend[] }).legend ?? []).map((l) => l.data.map(itemName));

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
    expect([...new Set(v.points.map((p) => p.exponent))].sort((a, b) => a - b)).toEqual([
      5, 5.5, 5.75, 6, 7, 7.25, 7.5, 8, 8.25, 8.5, 9,
    ]);
  });

  it('단계 기록 목록이 없으면 원천 기록의 점만 · 읽은 양 · 저장 비용은 비고 왜? 카드는 쉬운 문장으로', () => {
    const noList = patch('053-control-refine.md', '053-control-refine.md', (b) => {
      delete cond(b).stageRecords;
    });
    const r = readPerf([...real.slice(0, 5), noList]);
    expect(r.stageRecords).toBeNull();
    expect(r.points).toHaveLength(180);
    expect(r.scan).toEqual([]);
    expect(r.storage).toEqual([]);
    expect(readShare(r, 'Q2')).toBeNull();
    expect(rowBytes(r)).toBeNull();
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
    expect(v.counts.undrawn + v.counts.nonPositive).toBe(0);
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

describe('읽은 양 · 저장 비용 판독 — 결정적 값 · 구조 사실', () => {
  it('원리 증거는 단계 5점 · Q5x 제외 · 힙 블록 = 같은 기록 Q5 I1 hit + read · Q3 I2 10^9 128.2%(방문 횟수)', () => {
    expect(v.scan.map((s) => s.record)).toEqual(['048', '049', '050', '051', '052']);
    const s9 = v.scan.find((s) => s.exponent === 9);
    expect(s9?.heapBlocks).toBe(9_345_856);
    expect(s9?.queries.map((q) => q.query)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
    expect(s9?.queries.find((q) => q.query === 'Q3')?.pg.I2?.bufferRatio).toBeCloseTo(1.2823, 4);
    expect(s9?.queries.find((q) => q.query === 'Q5')?.ch?.readBytesRatio).toBeCloseTo(8e9 / (1e9 * 41));
    // 계획 노드는 051 · 052만
    expect(v.scan.find((s) => s.exponent === 5)?.queries[0]?.pg.I1?.nodes).toBeNull();
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
  });

  it('왜? 카드 ① 읽은 양 — 가장 큰 단계(10^9) · 선택 질문 · PG ÷ CH 배수', () => {
    const r = readShare(v, 'Q2');
    expect(r?.exponent).toBe(9);
    expect(r?.ch).toBeCloseTo(9.011e-5, 7);
    expect(r?.pg).toBeCloseTo(0.010743, 5);
    expect(timesText(r?.times ?? 0)).toBe('119');
    expect(shareText(r?.pg ?? 0)).toBe('1.1%');
    expect(shareText(r?.ch ?? 0)).toBe('0.009%');
    // PG가 같은 페이지를 여러 번 읽으면 1을 넘는다 — "전체의 1.3배"(128.2%로 쓰지 않는다)
    expect(shareText(readShare(v, 'Q3')?.pg ?? 0)).toBe('전체의 1.3배');
    expect(shareText(1)).toBe('전부');
  });

  it('왜? 카드 ② 1행 저장 바이트 — CH 압축 열 · PG 힙 + B-tree 목차 · 몇 배 작은가', () => {
    const b = rowBytes(v);
    expect(b?.exponent).toBe(9);
    expect(Math.round(b?.ch ?? 0)).toBe(5);
    expect(Math.round(b?.pg ?? 0)).toBe(108);
    expect(timesText(b?.times ?? 0)).toBe('24');
  });
});

describe('그림 1 · 그림 2 — 쉬운 말 판독(웜 · PG(B-tree) 기준)', () => {
  it('그림 1 — 질문 5개 × 10억 행 배수 · 이긴 쪽은 3/3 우열(정본) · Q1은 PG 1.7배 · Q3는 CH 101배', () => {
    const bars = speedBars(v);
    expect(bars.map((b) => b.query)).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'Q5']);
    expect(bars.every((b) => b.exponent === 9)).toBe(true);
    expect(bars.map((b) => [b.winner, b.times])).toEqual([
      ['postgresql', '1.7'],
      ['clickhouse', '7.8'],
      ['clickhouse', '101'],
      ['clickhouse', '10'],
      ['clickhouse', '8.8'],
    ]);
    // 3번 결과가 같지 않으면(우열 미정) 방향 · 배수 없이 "승패 미정"
    const und = speedBars({
      points: v.points,
      verdicts: v.verdicts.map((x) => (x.query === 'Q2' ? { ...x, verdict: 'undetermined' as const } : x)),
    });
    expect(und.find((b) => b.query === 'Q2')).toMatchObject({
      kind: 'undetermined',
      winner: null,
      times: null,
    });
    // 그 규모에 점 쌍이 없으면 "판정 없음"
    const none = speedBars({
      points: v.points.filter((p) => !(p.query === 'Q4' && p.exponent === 9 && p.store === 'clickhouse')),
      verdicts: v.verdicts,
    });
    expect(none.find((b) => b.query === 'Q4')).toMatchObject({ kind: 'none', ratio: null });
    expect(speedBars({ points: [], verdicts: [] })).toEqual([]);
  });

  it('그림 2 문장 — 역전 구간을 쉬운 행 수로 · 역전 없음은 "모든 크기에서"', () => {
    expect(crossSentence(findRange(v.ranges, 'Q2', 'warm', 'I2'))).toBe(
      '약 3천만~1.8억 행 사이에서 역전 — 작으면 PG, 크면 CH가 빨라요',
    );
    expect(crossSentence(findRange(v.ranges, 'Q3', 'warm', 'I2'))).toBe(
      '약 56만~100만 행 사이에서 역전 — 작으면 PG, 크면 CH가 빨라요',
    );
    expect(crossSentence(findRange(v.ranges, 'Q1', 'warm', 'I2'))).toBe(
      '이 범위에서는 뒤집히지 않아요 — 앞선 쪽 PG',
    );
    expect(crossSentence(findRange(v.ranges, 'Q4', 'warm', 'I2'))).toBe(
      '이 범위에서는 뒤집히지 않아요 — 앞선 쪽 CH',
    );
    // 그림 1 행 툴팁의 구간 판정 문장
    expect(rangeText(findRange(v.ranges, 'Q1', 'warm', 'I2'))).toBe('PG 우세 전 구간');
    expect(rangeText(findRange(v.ranges, 'Q4', 'warm', 'I2'))).toBe('전 구간 CH');
    expect(rangeText(findRange(v.ranges, 'Q2', 'warm', 'I2'))).toBe(
      '약 3천만 행까지 PG · 약 1.8억 행부터 CH',
    );
    // 그림 2 ? 표지 — undetermined(Q2 웜 10^8)
    expect(undeterminedExps(v, 'Q2')).toEqual([8]);
    expect(undeterminedExps(v, 'Q1')).toEqual([]);
    expect(crossSentence(undefined)).toBe('이 질문은 누가 이기는지 판정한 기록이 없어요');
  });

  it('행 수 · 밀리초 · 배수 쉬운 표기 — 지수 표기를 쓰지 않는다', () => {
    expect([5, 6, 7, 8, 9].map(rowsWords)).toEqual(['10만 행', '100만 행', '1천만 행', '1억 행', '10억 행']);
    expect(rowsWords(7.5)).toBe('약 3천만 행');
    expect(rowsWords(8.25)).toBe('약 1.8억 행');
    expect(rowsWords(5.75)).toBe('약 56만 행');
    expect(msText(21827.079)).toBe('21,827');
    expect(msText(3.687)).toBe('3.7');
    expect(msText(0.177)).toBe('0.18');
    // 배수 반올림 — 반올림한 값으로 자릿수를 고른다
    expect(timesText(9.96)).toBe('10');
    expect(timesText(9.94)).toBe('9.9');
    expect(timesText(1234.4)).toBe('1,234');
    expect(rowsTick(1e8)).toBe('1억');
    expect(rowsTick(10 ** 7.5)).toBe('');
  });

  it('최대 규모 배수(참고값) — 두 저장소 점이 함께 있는 가장 큰 지수 · Q1 웜 10^9는 PG가 빠르다', () => {
    const t = topRatio(v.points, 'Q1', 'warm', 'I2');
    expect(t?.exponent).toBe(9);
    expect((t?.ratio ?? 2) < 1).toBe(true);
    expect(topRatio([], 'Q1', 'warm', 'I2')).toBeNull();
  });

  it('그림 2 옵션 — 선 2개(PG · CH) · 역전 음영 "여기서 역전!" · 내 측정 점 · SVG로 실제 그려진다', () => {
    const lines = curveLines(v.points, 'Q2', 'warm').filter((l) => l.key !== 'I1');
    const live = {
      ch: [{ rows: 1e5, exponent: 5, median: 3, values: [3, 3, 3], resultRows: 1, resultMatch: true }],
      pg: [{ rows: 1e5, exponent: 5, median: 0.3, values: [0.3], resultRows: 1, resultMatch: true }],
    };
    const opt = curveOption({ lines, range: findRange(v.ranges, 'Q2', 'warm', 'I2'), live }) as unknown as {
      legend: Legend[];
      series: { id: string; markArea?: { data: { xAxis: number; name?: string }[][] } }[];
    };
    expect(legendNames(opt)).toEqual([['PostgreSQL', 'ClickHouse', LIVE_NAME]]);
    expect(opt.series.map((s) => s.id)).toEqual(['line-clickhouse', 'line-postgresql', 'live-pg', 'live-ch']);
    const area = opt.series.find((s) => s.markArea)?.markArea?.data[0];
    expect(area?.[0]?.xAxis).toBeCloseTo(10 ** 7.5);
    expect(area?.[1]?.xAxis).toBeCloseTo(10 ** 8.25);
    expect(area?.[0]?.name).toBe(CROSS_LABEL);
    expect(opt.series.filter((s) => s.markArea)).toHaveLength(1);
    // 역전 없는 질문은 음영 없음 · 내 측정이 없으면 범례에도 없다
    const q1 = curveOption({
      lines: curveLines(v.points, 'Q1', 'warm').filter((l) => l.key !== 'I1'),
      range: findRange(v.ranges, 'Q1', 'warm', 'I2'),
      live: { ch: [], pg: [] },
    }) as unknown as { series: { markArea?: unknown }[] };
    expect(q1.series.some((s) => s.markArea)).toBe(false);
    expect(legendNames(q1)).toEqual([['PostgreSQL', 'ClickHouse']]);
    const c = init(null as unknown as HTMLElement, undefined, {
      renderer: 'svg',
      ssr: true,
      width: 540,
      height: 220,
    });
    c.setOption(opt as never);
    const svg = c.renderToSVGString();
    expect(svg).toContain(CROSS_LABEL);
    expect(svg).toContain('10억');
    expect(svg).toContain('걸린 시간(밀리초)');
    expect(svg).not.toContain('10^');
    c.dispose();
  });

  it('그림 2 우열 미정 — "?" 대신 그 규모의 점을 속 빈 점(툴팁 "3번 결과가 엇갈린 점") · 범례 한 항목은 그 점이 있을 때만 · 역전 표지 흰 바탕(§7.1 R5)', () => {
    type Pt = { value: [number, number]; symbol: string; symbolSize?: number };
    type S = {
      id: string;
      name: string;
      data: Pt[];
      markLine?: unknown;
      markArea?: { label: Record<string, unknown> };
      tooltip?: { formatter: (x: { dataIndex?: number }) => string };
    };
    const lines = curveLines(v.points, 'Q2', 'warm').filter((l) => l.key !== 'I1');
    const und = undeterminedExps(v, 'Q2');
    expect(und).toEqual([8]);
    const opt = curveOption({
      lines,
      range: findRange(v.ranges, 'Q2', 'warm', 'I2'),
      live: { ch: [], pg: [] },
      undetermined: und,
    }) as unknown as { legend: Legend[]; series: S[] };
    // 색 범례는 그대로 · 모양 범례(둘째 줄 오른쪽 · 누를 수 없음)에 속 빈 점 한 항목
    expect(legendNames(opt)).toEqual([['PostgreSQL', 'ClickHouse'], [HOLLOW_NAME]]);
    expect(opt.legend[1]).toMatchObject({ top: 17, right: 0, selectedMode: false });
    expect(HOLLOW_NAME).toBe('속 빈 점 = 3번 결과가 엇갈림');
    // 뜻 없는 "?" 세로 점선은 없다
    expect(opt.series.some((x) => x.markLine)).toBe(false);
    expect(JSON.stringify(opt)).not.toContain('"?"');
    for (const id of ['line-clickhouse', 'line-postgresql']) {
      const ser = opt.series.find((x) => x.id === id);
      const at = ser?.data.findIndex((d) => Math.abs(Math.log10(d.value[0]) - 8) < 1e-6) ?? -1;
      expect(at).toBeGreaterThanOrEqual(0);
      expect(ser?.data[at]).toMatchObject({ symbol: 'emptyCircle', symbolSize: 10 });
      expect(ser?.tooltip?.formatter({ dataIndex: at })).toContain(UNDETERMINED_TIP);
      // 다른 규모의 점은 그대로(결과 일치 점은 속 찬 점 · 툴팁에 미정 문구 없음)
      const other = ser?.data.findIndex((d) => Math.abs(Math.log10(d.value[0]) - 9) < 1e-6) ?? -1;
      expect(ser?.data[other]?.symbolSize).toBeUndefined();
      expect(ser?.tooltip?.formatter({ dataIndex: other })).not.toContain(UNDETERMINED_TIP);
    }
    expect(UNDETERMINED_TIP).toBe('3번 결과가 엇갈린 점');
    // 범례 그림만 그리는 빈 계열(속 빈 점 · 중립 slate)
    expect(opt.series.find((x) => x.name === HOLLOW_NAME)).toMatchObject({
      data: [],
      symbol: 'emptyCircle',
      color: LEGEND_INK,
    });
    // "여기서 역전!" — 흰 바탕 · 여백(음영 · 선이 글자를 지나도 읽힌다)
    expect(opt.series.find((x) => x.markArea)?.markArea?.label).toMatchObject({
      backgroundColor: '#ffffff',
      padding: [2, 6],
    });
    // 미정 점이 없는 질문(Q1) · 미정 규모에 그린 점이 없으면 범례 항목도 없다
    const q1 = curveOption({
      lines: curveLines(v.points, 'Q1', 'warm').filter((l) => l.key !== 'I1'),
      range: findRange(v.ranges, 'Q1', 'warm', 'I2'),
      live: { ch: [], pg: [] },
      undetermined: undeterminedExps(v, 'Q1'),
    });
    expect(legendNames(q1)).toEqual([['PostgreSQL', 'ClickHouse']]);
    const offGrid = curveOption({
      lines,
      range: undefined,
      live: { ch: [], pg: [] },
      undetermined: [4],
    });
    expect(legendNames(offGrid).flat()).not.toContain(HOLLOW_NAME);
    // SVG로 실제 그려진다 — 범례 글자 · 역전 표지
    const c = init(null as unknown as HTMLElement, undefined, {
      renderer: 'svg',
      ssr: true,
      width: 536,
      height: 220,
    });
    c.setOption(opt as never);
    const svg = c.renderToSVGString();
    expect(svg).toContain(HOLLOW_NAME);
    expect(svg).toContain(CROSS_LABEL);
    expect(svg).not.toContain('>?<');
    c.dispose();
  });

  it('그림 2 결과 불일치 — 삼각형(툴팁 "두 DB 결과가 달라요") · 범례 "삼각형 = 두 DB 결과가 다름"은 그 점이 있을 때만 · 우열 미정과 겹치면 속 빈 삼각형 · 속 빈 원은 우열 미정만(§9 P2)', () => {
    type Pt = { value: [number, number]; symbol: string; symbolSize?: number };
    type S = {
      id: string;
      name: string;
      color?: string;
      symbol?: string;
      data: Pt[];
      tooltip?: { formatter: (x: { dataIndex?: number }) => string };
    };
    const at = (e: number) => (p: { exponent: number }) => Math.abs(p.exponent - e) < 1e-6;
    // 10^8 · 10^9 점을 결과 불일치로(메모리에서만) — 10^8은 우열 미정 규모이기도 하다
    const lines = curveLines(v.points, 'Q2', 'warm')
      .filter((l) => l.key !== 'I1')
      .map((l) => ({
        ...l,
        points: l.points.map((p) => (at(8)(p) || at(9)(p) ? { ...p, resultMatch: false } : p)),
      }));
    const opt = curveOption({
      lines,
      range: findRange(v.ranges, 'Q2', 'warm', 'I2'),
      live: { ch: [], pg: [] },
      undetermined: [8],
    }) as unknown as {
      legend: (Legend & { tooltip: { formatter: (x: { name: string }) => string } })[];
      series: S[];
    };
    for (const id of ['line-clickhouse', 'line-postgresql']) {
      const ser = opt.series.find((x) => x.id === id);
      const idx = (e: number) =>
        ser?.data.findIndex((d) => at(e)({ exponent: Math.log10(d.value[0]) })) ?? -1;
      // 불일치만 — 속 찬 삼각형 · 불일치 + 우열 미정 — 속 빈 삼각형 · 나머지는 속 찬 원(속 빈 원 없음)
      expect(ser?.data[idx(9)]).toMatchObject({ symbol: 'triangle', symbolSize: 9 });
      expect(ser?.data[idx(8)]).toMatchObject({ symbol: 'emptyTriangle', symbolSize: 10 });
      expect(ser?.data.filter((d) => d.symbol === 'emptyCircle')).toEqual([]);
      expect(ser?.tooltip?.formatter({ dataIndex: idx(9) })).toContain(`${MISMATCH_TIP}(삼각형)`);
      expect(ser?.tooltip?.formatter({ dataIndex: idx(9) })).not.toContain(UNDETERMINED_TIP);
      expect(ser?.tooltip?.formatter({ dataIndex: idx(8) })).toContain(UNDETERMINED_TIP);
      expect(ser?.tooltip?.formatter({ dataIndex: idx(8) })).toContain(MISMATCH_TIP);
      expect(ser?.tooltip?.formatter({ dataIndex: idx(7) })).not.toContain(MISMATCH_TIP);
    }
    expect([MISMATCH_TIP, TRIANGLE_NAME]).toEqual(['두 DB 결과가 달라요', '삼각형 = 두 DB 결과가 다름']);
    // 모양 범례 둘(속 빈 점 · 삼각형) — 데이터 없는 계열 · 중립 slate · 툴팁은 그 뜻
    expect(legendNames(opt)).toEqual([
      ['PostgreSQL', 'ClickHouse'],
      [HOLLOW_NAME, TRIANGLE_NAME],
    ]);
    expect(opt.series.find((x) => x.name === TRIANGLE_NAME)).toMatchObject({
      data: [],
      symbol: 'triangle',
      color: LEGEND_INK,
    });
    expect(opt.legend[1]?.tooltip.formatter({ name: TRIANGLE_NAME })).toBe(MISMATCH_TIP);
    expect(opt.legend[1]?.tooltip.formatter({ name: HOLLOW_NAME })).toBe(UNDETERMINED_TIP);
    // 불일치 점만 있고 우열 미정이 없으면 삼각형 항목 하나 · 불일치 점이 없으면 모양 범례 없음
    const only = curveOption({ lines, range: undefined, live: { ch: [], pg: [] } });
    expect(legendNames(only)).toEqual([['PostgreSQL', 'ClickHouse'], [TRIANGLE_NAME]]);
    const none = curveOption({
      lines: curveLines(v.points, 'Q2', 'warm').filter((l) => l.key !== 'I1'),
      range: undefined,
      live: { ch: [], pg: [] },
    });
    expect(legendNames(none)).toEqual([['PostgreSQL', 'ClickHouse']]);
    // SVG로 실제 그려진다 — 두 모양 범례 글자
    const c = init(null as unknown as HTMLElement, undefined, {
      renderer: 'svg',
      ssr: true,
      width: 534,
      height: 220,
    });
    c.setOption(opt as never);
    const svg = c.renderToSVGString();
    expect(svg).toContain(TRIANGLE_NAME);
    expect(svg).toContain(HOLLOW_NAME);
    c.dispose();
  });

  it('그림 2 내 측정 — CH · PG 모두 속 찬 마름모(색이 저장소를 가른다) · 범례 마름모는 중립 slate(§9 P2)', () => {
    const live = {
      ch: [{ rows: 1e6, exponent: 6, median: 5, values: [5, 4, 6], resultRows: 1, resultMatch: true }],
      pg: [{ rows: 1e6, exponent: 6, median: 9, values: [9, 8, 10], resultRows: 1, resultMatch: true }],
    };
    const opt = curveOption({ lines: [], range: undefined, live }) as unknown as {
      legend: Legend[];
      series: { id: string; symbol?: string; color?: string }[];
    };
    expect(opt.series.map((x) => [x.id, x.symbol])).toEqual([
      ['live-pg', 'diamond'],
      ['live-ch', 'diamond'],
    ]);
    expect(JSON.stringify(opt)).not.toContain('emptyDiamond');
    expect(opt.legend[0]?.data[2]).toEqual({ name: LIVE_NAME, itemStyle: { color: LEGEND_INK } });
    // 실제 그림 — 범례 마름모는 slate로 칠하고 점 마름모는 저장소 색으로 칠한다(둘 다 속이 찼다 · 흰 속 없음)
    const c = init(null as unknown as HTMLElement, undefined, {
      renderer: 'svg',
      ssr: true,
      width: 534,
      height: 220,
    });
    c.setOption(opt as never);
    const svg = c.renderToSVGString();
    c.dispose();
    const diamonds = [...svg.matchAll(/<path d="M[^"]*L[^"]*L[^"]*L[^"]*Z"[^>]*>/g)].map((m) => m[0]);
    const fills = diamonds.map((d) => /fill="([^"]+)"/.exec(d)?.[1]);
    expect(fills).toEqual(expect.arrayContaining([LEGEND_INK, '#2563eb', '#d97706']));
    expect(fills).not.toContain('#fff');
  });

  it('그림 2 범례 폭 — Pretendard 12px 실측으로 첫 줄(색 범례 셋) · 둘째 줄(축 이름 + 모양 범례 둘)이 1440 · 1280 그림 폭 안 · 다섯을 한 줄에 두면 넘친다', () => {
    const width = pretendardRegular();
    // 글꼴 표를 제대로 읽었다 — 한글 0.864em(test/flow-layout과 같은 값)
    expect(width('가', 100)).toBeCloseTo(86.4, 1);
    // ECharts 범례 한 항목 = 그림 16 + 틈 5 + 글자 · 항목 사이 16 · 범례 안쪽 여백 5
    const items = (names: string[]) =>
      names.reduce((w, n) => w + 16 + 5 + width(n, 12), 0) + 16 * (names.length - 1);
    // 그림(캔버스) 폭 = 구역 폭 − 테두리 2 − 좌우 여백 32 · 구역 폭 = (본문 − 칸 사이 16) ÷ 2 · 본문 = 창 − 내비 − 여백 40(최대 1408)
    const canvas = (w: number, nav: number) => (Math.min(w - nav - 40, 1408) - 16) / 2 - 34;
    const widths = { '1440 × 900': canvas(1440, 248), '1280 × 800(레일)': canvas(1280, 56) };
    expect(Object.values(widths)).toEqual([534, 550]);
    const line1 = 5 + items(['PostgreSQL', 'ClickHouse', LIVE_NAME]) + 5;
    // 둘째 줄 — 축 이름은 왼쪽 4부터(그림 왼쪽 48 − 44) · 모양 범례는 오른쪽 끝(여백 5)부터 왼쪽으로
    const axisEnd = 4 + width(Y_AXIS_NAME, 12);
    const shapes = items([HOLLOW_NAME, TRIANGLE_NAME]) + 5;
    for (const [name, w] of Object.entries(widths)) {
      expect(line1, `${name} 첫 줄`).toBeLessThanOrEqual(w);
      expect(w - shapes - axisEnd, `${name} 둘째 줄 축 이름 ~ 모양 범례 틈`).toBeGreaterThanOrEqual(16);
      // 한 범례에 다섯을 다 두면 그림 폭을 넘어 두 줄로 접힌다 — 그래서 모양 범례를 둘째 줄로 나눴다
      expect(
        5 + items(['PostgreSQL', 'ClickHouse', LIVE_NAME, HOLLOW_NAME, TRIANGLE_NAME]) + 5,
      ).toBeGreaterThan(w);
    }
    // 근거 숫자(보고용) — 첫 줄 약 303 · 축 이름 끝 약 164 · 모양 범례 약 331("3번" 포함 · 1440 둘째 줄 틈 약 39)
    expect(line1).toBeCloseTo(303.3, 0);
    expect(axisEnd).toBeCloseTo(164.1, 0);
    expect(shapes).toBeCloseTo(331.3, 0);
  });

  it('진입 파라미터는 q 하나 — 벗어난 값은 Q2', () => {
    expect(parsePerfParams({})).toEqual({ query: 'Q2' });
    expect(parsePerfParams({ q: 'Q3' })).toEqual({ query: 'Q3' });
    expect(parsePerfParams({ q: ['Q5', 'Q1'] })).toEqual({ query: 'Q5' });
    expect(parsePerfParams({ q: 'Q9' })).toEqual({ query: 'Q2' });
  });
});

/**
 * 넓고 높은 화면 변형 클래스(roomy.ts — 가로 ≥ 1680 · 세로 ≥ 1000에서만 켜짐)를 걷어 낸 HTML — 1440 × 900 · 1280 × 800에서 실제로 쓰이는 바탕 클래스(§9 P1).
 * 아래 클래스 단언은 이 바탕 위에서 본다 — 변형을 덧붙이기 전과 글자 하나 다르지 않아야 한다.
 */
const baseHtml = (html: string) =>
  html.replaceAll(/ \[@media\(min-width:1680px\)_and_\(min-height:1000px\)\]:[^\s"]+/g, '');

/** 화면 1층에 보이는 글자 — title · data-* 속성(툴팁 · 시험 표지)을 걷어 낸 HTML */
const visibleText = (html: string) => html.replace(/\s(title|data-[a-z-]+|aria-label)="[^"]*"/g, '');
const CODE = /\b(Q[1-5]|I[12]|EXP-\d+|SW-\d+)\b|10\^/;

describe('화면 — 두 열 · 한 장(스크롤 · 서랍 · 탭 없음)', () => {
  const EVID = path.resolve(__dirname, '../../../docs/measurements');
  const evFiles = ['040', '041', '042', '043', '044', '045', '046', '047'].map((n) => {
    const name = readdirSync(EVID).find((f) => f.startsWith(`${n}-`)) as string;
    return { name, text: readFileSync(path.join(EVID, name), 'utf8') };
  });
  const evidence = readEvidence(evFiles);
  const wrap = (el: ReturnType<typeof createElement>, client = new QueryClient()) =>
    renderToStaticMarkup(
      createElement(QueryClientProvider, { client }, createElement(RunProvider, { type: 'perf' }, el)),
    );
  const sensor = (view: PerfView | undefined, query = 'Q2', failed = false) =>
    baseHtml(wrap(createElement(SensorColumn, { view, failed, query, onQuery: () => {} })));
  const business = (d: Parameters<typeof BusinessColumn>[0]['d'], failed = false) =>
    baseHtml(wrap(createElement(BusinessColumn, { d, failed })));

  it('① 센서 데이터 — 결론 · 그림 1 질문 5행(선택 Q2) · 그림 2 문장 · 왜? 카드 2 · 코드 문자열 없음', () => {
    const html = sensor(v);
    expect(html).toContain('데이터가 많아질수록 ClickHouse가 훨씬 빨라요');
    expect(html).toContain('그림 1 · 10억 행일 때, 질문별로 누가 몇 배 빠른가');
    expect(html.match(/data-testid="speed-row"/g)).toHaveLength(5);
    for (const n of [
      '센서 1개 · 최근 1시간',
      '센서 1개 · 7일',
      '설비 1대 · 하루',
      '전체 설비 · 1분 평균',
      '전체 데이터 훑기',
    ])
      expect(html).toContain(n);
    expect(html).toMatch(/aria-pressed="true"[^>]*data-query="Q2"/);
    for (const t of ['PG 1.7배', 'CH 7.8배', 'CH 101배', 'CH 10배', 'CH 8.8배']) expect(html).toContain(t);
    expect(html).toContain('약 3천만~1.8억 행 사이에서 역전');
    expect(html).toContain('왜 그럴까?');
    expect(html).toContain('필요한 칸만 읽어요');
    expect(html).toContain('같은 값끼리 모아 줄여요');
    // 답 숫자는 문장 안 16px 굵게(text-base) — "몫"은 화면 1층에 없다(툴팁에만)
    expect(html).toMatch(/<b class="text-base[^"]*tabular-nums">119배<\/b>/);
    expect(html).toMatch(/<b class="text-base[^"]*tabular-nums">24배<\/b>/);
    // 숫자 자리는 고정 폭 숫자(R9) — 막대 라벨 · 답 숫자 · 바이트 숫자
    expect(html).toMatch(/whitespace-nowrap tabular-nums">약 4\.5바이트</);
    expect(html).toContain('전체 중 읽는 비율이 PG가 ');
    expect(visibleText(html)).not.toContain('몫');
    // 그림 1 — 막대 18px · 막대 끝 배수 16px 굵게 · 줄 전체가 버튼(선택 점) · 안내 · 축 머리
    expect(html).toContain('h-[18px]');
    expect(html).toMatch(
      /text-base leading-none font-bold[^"]*tabular-nums" style="color:#b45309">CH 101배</,
    );
    expect(html).toContain('줄을 누르면 아래 그림이 그 질문으로 바뀌어요');
    expect(html).toContain('← PostgreSQL이 빨라요');
    expect(html).toContain('ClickHouse가 빨라요 →');
    // 구역 = 머리 띠(연한 주황) + 흰 본문 한 겹 — 2px 색 테두리 · 안쪽 상자 없음
    expect(html).toContain('bg-store-ch-soft');
    expect(html).not.toContain('border-2');
    expect(html).not.toMatch(/rounded-md border border-slate-200/);
    expect(visibleText(html)).not.toMatch(CODE);
    expect(html).not.toContain('aria-expanded');
  });

  it('① 그림 1 행 클릭 대상 · 질문 바꾸면 그림 2 머리 · 왜? ① 문장이 따라간다', () => {
    const html = sensor(v, 'Q3');
    expect(html).toContain('그림 2 · 설비 1대 · 하루 — 데이터가 많아질수록 걸리는 시간');
    expect(html).toContain('약 56만~100만 행 사이에서 역전');
    expect(html).toContain('전체의 1.3배');
  });

  it('① 그림 1 판정 없는 줄(비슷 · 승패 미정 · 판정 없음) 글자는 slate-600 — 선택 · hover 바탕 위에서도 4.5:1 이상(§7.1 R13)', () => {
    const und: PerfView = {
      ...v,
      verdicts: v.verdicts.map((x) =>
        x.query === 'Q2' && x.exponent === 9 ? { ...x, verdict: 'undetermined' as const } : x,
      ),
    };
    const html = sensor(und);
    expect(html).toContain('<span class="text-label text-slate-600">승패 미정</span>');
    expect(html).not.toMatch(/text-slate-500">(비슷|승패 미정|판정 없음)</);
  });

  it('① 그림 1 막대 — 배수 라벨 칸(5.25rem)을 모든 줄에 같게 비워 막대 기준 폭이 같다 · 길이는 로그 비(§7.1 R2)', () => {
    const html = sensor(v);
    const rows = html.split('data-testid="speed-row"').slice(1);
    expect(rows).toHaveLength(5);
    const max = Math.max(...speedBars(v).map((b) => (b.ratio ? Math.max(b.ratio, 1 / b.ratio) : 1)));
    expect(max.toFixed(4)).toBe('100.5856');
    for (const [i, b] of speedBars(v).entries()) {
      const row = rows[i] ?? '';
      // 두 반쪽이 모두 같은 칸을 비운다 — PG 쪽 pl · CH 쪽 pr(라벨이 어느 쪽에 있든)
      expect(row).toContain('border-r border-slate-300 pl-[5.25rem]');
      expect(row).toContain('pr-[5.25rem]');
      const t = b.ratio === null ? 1 : b.winner === 'clickhouse' ? b.ratio : 1 / b.ratio;
      const w = /data-testid="speed-fill"[^>]*style="width:([\d.]+)%/.exec(row)?.[1];
      expect(Number(w)).toBeCloseTo((Math.log10(t) / Math.log10(max)) * 100, 6);
      // 라벨은 막대 바로 옆(CH 쪽은 막대 뒤 · PG 쪽은 막대 앞) — 같은 반쪽 안 이웃
      expect(row).toMatch(
        b.winner === 'clickhouse'
          ? /data-testid="speed-fill"[^>]*><\/span><span class="[^"]*tabular-nums"/
          : /tabular-nums" style="[^"]*">PG [\d.]+배<\/span><span data-testid="speed-fill"/,
      );
    }
    // 손 계산 — log10(7.817) ÷ log10(100.59) = 0.8930 ÷ 2.0025 = 44.6% · PG 1.7배 log10(1.738) ÷ 2.0025 = 12.0%
    expect(Number.parseFloat(barWidth(7.817, 100.5856))).toBeCloseTo(44.6, 1);
    expect(Number.parseFloat(barWidth(1 / 0.5753, 100.5856))).toBeCloseTo(12.0, 1);
    expect(barWidth(1.05, 100.5856)).toBe('6%');
  });

  it('① 로딩 · 오류 · 기록 없음', () => {
    // 로딩 자리 깜빡임은 움직임 줄이기 설정이면 멈춘다(R7) — 업무 구역 로딩 자리도 같다
    expect(sensor(undefined)).toContain('motion-safe:animate-pulse');
    expect(sensor(undefined)).not.toMatch(/(?<![\w:])animate-pulse/);
    const bizLoading = business(undefined);
    expect(bizLoading).toContain('motion-safe:animate-pulse');
    expect(bizLoading).not.toMatch(/(?<![\w:])animate-pulse/);
    expect(sensor(undefined, 'Q2', true)).toContain('기록을 읽지 못했어요');
    const empty = sensor(readPerf([]));
    expect(empty).toContain('아직 잰 기록이 없어요');
    expect(empty).not.toContain('데이터가 많아질수록 ClickHouse가 훨씬 빨라요');
    // 단계 기록 없음 — 왜? 카드 "단계 기록이 없어요"
    expect(sensor({ ...v, scan: [], storage: [] })).toContain('단계 기록이 없어요');
  });

  it('② 업무 데이터 — 상황 카드 4 · PG ✓ / CH ✕ · 쉬운 숫자 문장 · 왜? 한 줄 · 상태 갱신 카드 없음 · 코드 없음', () => {
    const html = business(evidence);
    expect(html).toContain('정확해야 하는 업무 데이터는 PostgreSQL이 맞아요');
    expect(html.match(/data-testid="situation-card"/g)).toHaveLength(4);
    for (const t of [
      '작업 완료 중 오류가 나면?',
      '규칙에 어긋나는 데이터를 넣으면?',
      '주문 1건 찾기',
      '1건씩 아주 자주 저장하기',
    ])
      expect(html).toContain(t);
    // 정확성 줄 — 앞 조각 · 답 조각(16px 굵게 · 지킴 초록 · 못 지킴 빨강) · 지킴 표시는 그린 아이콘(sr-only 낱말)
    expect(html).toMatch(
      />전부 되돌림<\/span><span class="truncate text-base font-bold tabular-nums text-emerald-700">깨진 데이터 0건</,
    );
    expect(html).toMatch(
      />반만 저장<\/span><span class="truncate text-base font-bold tabular-nums text-red-700">20번 중 20번 깨짐</,
    );
    expect(html).toContain('>막아 냄<');
    expect(html).toContain('>받아도 되는 2건만 받음<');
    expect(html).toContain('>규칙을 어긴 데이터 15건까지 받음<');
    expect(html.match(/data-ok="true"/g)).toHaveLength(2);
    expect(html.match(/data-ok="false"/g)).toHaveLength(2);
    expect(html).toContain('<span class="sr-only">지킴</span>');
    expect(html).toContain('<span class="sr-only">못 지킴</span>');
    // 속도 줄 — 막대 2개(로그 길이) · 숫자 · "N배 이상 느림" 16px 굵게
    expect(html).toContain('>보통 0.1밀리초<');
    expect(html).toContain('>보통 4.2~4.3밀리초<');
    expect(html).toMatch(/text-base font-bold tabular-nums text-red-700">40배 이상 느림</);
    // 1920 × 1080에서 줄 사이가 벌어지지 않게(§7.1 R11a · L4) — 네 줄은 내용 높이(늘지 않음) · 줄 사이 틈 칸 3개는 최대 2rem(+ 줄 여백 8 + 8 = 48px) · 남는 높이는 구역 아래
    expect(
      html.match(/data-testid="situation-card"[^>]*class="flex shrink-0 flex-col gap-0\.5 py-2"/g),
    ).toHaveLength(4);
    expect(html).not.toMatch(/data-testid="situation-card"[^>]*class="[^"]*flex-1/);
    expect(html.match(/data-testid="situation-gap" class="[^"]*\bmax-h-8\b[^"]*\bflex-1\b/g)).toHaveLength(3);
    expect(html).not.toContain('justify-center gap-0.5');
    // 이긴 쪽 알약 — 네 줄 모두 PostgreSQL
    expect(html.match(/data-testid="situation-winner"/g)).toHaveLength(4);
    expect(html).toContain('(트랜잭션)');
    expect(html).not.toContain('border-2');
    expect(html).toContain('PG는 여러 작업을 한 묶음으로 처리해서, 중간에 실패하면 전부 되돌려요');
    expect(html).not.toContain('상태 갱신');
    expect(visibleText(html)).not.toMatch(CODE);
    expect(visibleText(html)).not.toMatch(/p50|MVCC|WAL|그래뉼|B-tree/);
  });

  it('② 기록 0 — 결론 대신 "아직 잰 기록이 없어요" · 카드 4는 제목과 왜? · 수치 줄 "잰 값 없음"', () => {
    const html = business(readEvidence([]));
    expect(html.match(/data-testid="situation-card"/g)).toHaveLength(4);
    expect(html).toContain('아직 잰 기록이 없어요');
    expect(html).not.toContain('정확해야 하는 업무 데이터는 PostgreSQL이 맞아요');
    expect(html.match(/잰 값 없음/g)).toHaveLength(8);
    expect(business(undefined, true)).toContain('기록을 읽지 못했어요');
  });

  it('넓고 높은 화면(가로 ≥ 1680 · 세로 ≥ 1000)만 두 구역 글자 한 단계 — 변형은 미디어 하나 · 바탕 클래스 옆에 덧붙이기만(§9 P1)', () => {
    const raw = [
      wrap(createElement(SensorColumn, { view: v, failed: false, query: 'Q2', onQuery: () => {} })),
      wrap(createElement(BusinessColumn, { d: evidence, failed: false })),
    ].join('');
    // 미디어 변형은 roomy.ts 하나뿐(다른 조건이 섞이지 않는다) · 걷어 내면 미디어 글자가 남지 않는다
    const media = new Set([...raw.matchAll(/\[@media\([^\]]*\)\]/g)].map((m) => m[0]));
    expect([...media]).toEqual(['[@media(min-width:1680px)_and_(min-height:1000px)]']);
    expect(ROOMY_MEDIA).toBe('(min-width:1680px) and (min-height:1000px)');
    expect(baseHtml(raw)).not.toContain('@media');
    // 바탕 클래스 그대로 + 한 단계 큰 클래스 — 업무: 질문 14 → 16 · 답 숫자 16 → 20 · 왜? 13 → 14 · PG/CH 표지 12 → 13 · 줄 높이 24 → 32 · 틈 칸 최대 32 → 48
    const cls = (c: string) =>
      (raw.match(new RegExp(`class="${c.replace(/[[\]().:/]/g, '\\$&')}"`, 'g')) ?? []).length;
    expect(cls(`min-w-0 truncate text-sm font-bold text-slate-900 ${ROOMY.sm}`)).toBe(4);
    expect(cls(`truncate text-base font-bold tabular-nums ${ROOMY.base} text-emerald-700`)).toBe(2);
    expect(cls(`truncate text-base font-bold tabular-nums text-red-700 ${ROOMY.base}`)).toBe(2);
    expect(cls(`text-label text-slate-600 ${ROOMY.label}`)).toBe(4);
    expect(cls(`w-6 shrink-0 text-xs font-semibold text-slate-500 ${ROOMY.xs}`)).toBe(8);
    expect(
      cls(`flex h-6 min-w-0 items-center gap-2 text-sm text-slate-800 ${ROOMY.bizLine} ${ROOMY.sm}`),
    ).toBe(8);
    expect(cls(`flex shrink-0 flex-col gap-0.5 py-2 ${ROOMY.bizGap}`)).toBe(4);
    expect(cls(`flex max-h-8 min-h-px flex-1 items-center ${ROOMY.bizGapMax}`)).toBe(3);
    // 센서: 그림 1 질문 이름 14 → 16 · 배수 16 → 20 · 막대 18 → 22 · 줄 30 → 36 · 이름 칸 9 → 10rem · 라벨 칸 84 → 104 · 머리 결론 16 → 20
    // 선택 줄 이름 1 + 왜? 두 줄 제목 2(같은 클래스)
    expect(cls(`truncate text-sm font-semibold text-slate-900 ${ROOMY.sm}`)).toBe(3);
    expect(cls(`truncate text-sm text-slate-700 ${ROOMY.sm}`)).toBe(4);
    expect(
      raw.match(/class="block h-\[18px\] shrink-0 rounded-[lr]-sm \[@media[^"]*\]:h-5\.5"/g),
    ).toHaveLength(5);
    expect(raw).toContain(`text-base leading-none font-bold whitespace-nowrap tabular-nums ${ROOMY.base}`);
    expect(
      raw.match(new RegExp(`hover:bg-slate-50 ${ROOMY.fig1Row.replace(/[[\]().:/]/g, '\\$&')} `, 'g')),
    ).toHaveLength(4);
    expect(raw).toContain(
      `grid grid-cols-[9rem_1fr_1fr] text-label font-medium ${ROOMY.fig1Cols} ${ROOMY.label}`,
    );
    expect(raw).toContain(`border-r border-slate-300 pl-[5.25rem] ${ROOMY.fig1PadL}`);
    expect(raw).toContain(`pr-[5.25rem] ${ROOMY.fig1PadR}`);
    expect(cls(`text-base font-bold text-slate-900 ${ROOMY.base}`)).toBe(2);
  });

  it('화면 전체 — 제목(h2 · h1 없음) · 두 열 · 한 줄 정리 · 회색 각주(툴팁에 기록 번호) · 탭 · 서랍 없음', () => {
    const client = new QueryClient();
    client.setQueryData(['measurements', 'perf'], { ...v, readAt: 0 });
    client.setQueryData(['measurements', 'evidence'], { readAt: 0, evidence });
    const html = renderToStaticMarkup(
      createElement(QueryClientProvider, { client }, createElement(PerfScreen, { initialQuery: 'Q2' })),
    );
    expect(html).toContain(`<h2 class="text-xl font-bold text-slate-900">${PERF_TITLE}</h2>`);
    expect(html).not.toContain('<h1');
    expect(html).toContain('aria-label="센서 데이터"');
    expect(html).toContain('aria-label="업무 데이터"');
    // 한 줄 정리 — 두 조각 알약(데이터 성격 → 맞는 DB) · 문장은 그대로
    expect(PERF_SUMMARY).toBe(
      '많이 쌓아 두고 크게 훑는 데이터 → ClickHouse · 정확하게 한 건씩 다루는 데이터 → PostgreSQL',
    );
    expect(html).toContain('많이 쌓아 두고 크게 훑는 데이터 → <b style="color:#b45309">ClickHouse</b>');
    expect(html).toContain('정확하게 한 건씩 다루는 데이터 → <b style="color:#1d4ed8">PostgreSQL</b>');
    expect(html).toContain(PERF_FOOTNOTE);
    // 각주 ⓘ 툴팁 — 원천 · 단계 기록 · 4요소 · 한계 2 · 판독 계수(0이어도) · 판독 시각 · 지금 기동
    const tip = /data-testid="perf-footnote-tip"[^>]*title="([^"]*)"/.exec(html)?.[1] ?? '';
    expect(tip).toContain('원천 기록 053(discarded) · 단계 기록 048 · 049 · 050 · 051 · 052');
    expect(tip).toContain('커밋 ');
    expect(tip).toContain('① ClickHouse 측정에 trace 로그 쓰기 부하가 포함됐다');
    expect(tip).toContain('판독 계수 — 파일 6 · 판독 불가 0');
    expect(tip).toContain('판독 1970-01-01');
    expect(tip).toContain('지금 기동 — 읽는 중');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('aria-expanded');
    expect(visibleText(html)).not.toMatch(CODE);
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
    const ev = (await (
      await GET(new Request('http://localhost/bff/measurements?view=evidence'))
    ).json()) as Record<string, unknown>;
    expect(Object.keys(ev).sort()).toEqual(['evidence', 'readAt']);
    delete process.env.MEASUREMENTS_DIR;
  });
});

describe('비율 → 백분율(B1 — 작은 비율이 0.0%로 뭉개지지 않는다)', () => {
  it('1% 미만은 유효 숫자 2자리 · 이상은 소수 1자리 · 0 · 아주 작은 값', () => {
    expect(ratioPercent(0.0001)).toBe('0.01%');
    expect(ratioPercent(0.000123)).toBe('0.012%');
    expect(ratioPercent(0.005)).toBe('0.5%');
    expect(ratioPercent(0.011)).toBe('1.1%');
    expect(ratioPercent(1.282)).toBe('128.2%');
    expect(ratioPercent(0)).toBe('0%');
    expect(ratioPercent(0.000001)).toBe('< 0.001%');
  });
});
