// 기록 판독기 — 10_observability/04 §BFF 판독 규칙 7 · 08_screen/07 §대조군 역전 지점. 픽스처는 이 파일 안에서 만든다(docs/measurements에 가짜 기록을 두지 않는다).
import { describe, expect, it } from 'vitest';
import {
  type ControlPoint,
  findCrossover,
  formatRows,
  jsonFences,
  memoryLimitText,
  readMeasurements,
  type SeriesPoint,
  selectSeries,
} from '../lib/measurements';

const SWITCHES = {
  'SW-01': 'on',
  'SW-02': 'on',
  'SW-03': 'on',
  'SW-04': 'on',
  'SW-05': 'on',
  'SW-06': 'on',
  'SW-07': 100,
  'SW-08': 'on',
  'SW-09': 'on',
  'SW-10': 'off',
  'SW-11': 'ingest',
};
const RUN = { commitHash: 'a1b2c3d', memoryProfile: 'load', memoryLimitMb: 4096, capacityTier: 'M' };

function block(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'measurement/v1',
    record: '031',
    exp: ['EXP-01', 'EXP-02', 'EXP-03', 'EXP-04', 'EXP-05'],
    status: 'valid',
    supersedes: null,
    window: { start: '2026-10-20T01:00:00.000Z', end: '2026-10-20T03:00:00.000Z' },
    run: RUN,
    switches: SWITCHES,
    conditions: { injectionMode: 'D' },
    repeat: { runs: 3, deviation: 0.08, threshold: 0.2 },
    results: [],
    points: [
      {
        query: 'Q1',
        rows: 1e6,
        stage: 2,
        store: 'postgresql',
        index: 'I1',
        cache: 'warm',
        unit: 'ms',
        values: [41.2, 39.8, 40.5],
        median: 40.5,
        resultMatch: true,
      },
      {
        query: 'Q1',
        rows: 1e6,
        stage: 2,
        store: 'clickhouse',
        index: null,
        cache: 'warm',
        unit: 'ms',
        values: [9.1, 9.4, 8.8],
        median: 9.1,
        resultMatch: true,
      },
    ],
    axes: [
      {
        axis: 'storage_bytes',
        store: 'postgresql',
        index: 'I1',
        rows: 1e6,
        value: 76_000_000,
        unit: 'bytes',
      },
    ],
    ...over,
  };
}

const md = (...blocks: unknown[]) =>
  `# 031 — 대조 격자 2단계\n\n> 실험: EXP-01~05\n\n${blocks
    .map((b) => (typeof b === 'string' ? b : `\`\`\`json\n${JSON.stringify(b, null, 2)}\n\`\`\``))
    .join('\n\n')}\n`;

describe('jsonFences', () => {
  it('json 펜스만 뽑는다 — plain 펜스는 기계 판독 블록이 아니다', () => {
    const text = '```plain\nx=1\n```\n\n```json\n{"a":1}\n```\n';
    expect(jsonFences(text)).toEqual(['{"a":1}\n']);
  });
});

describe('readMeasurements — 판독 규칙', () => {
  it('정상 대조 기록의 points · axes를 추출하고 단위를 ms로 맞춘다', () => {
    const r = readMeasurements([{ name: '031-control-stage-2.md', text: md(block()) }]);
    expect(r.counts).toMatchObject({ files: 1, unreadable: 0, control: 1, missingConditions: 0 });
    expect(r.points).toHaveLength(2);
    const pg = r.points.find((p) => p.store === 'postgresql');
    expect(pg).toMatchObject({
      query: 'Q1',
      rows: 1e6,
      index: 'I1',
      cache: 'warm',
      medianMs: 40.5,
      record: '031',
    });
    expect(pg?.run).toEqual(RUN);
    expect(r.axes).toEqual([
      expect.objectContaining({
        axis: 'storage_bytes',
        store: 'postgresql',
        value: 76_000_000,
        unit: 'bytes',
      }),
    ]);
  });

  it('초 단위 점은 ms로 바꾸고 모르는 단위의 점은 뺀다', () => {
    const b = block({
      points: [
        {
          query: 'Q5',
          rows: 1e5,
          store: 'clickhouse',
          index: null,
          cache: 'cold',
          unit: 's',
          values: [0.5],
          median: 0.5,
        },
        { query: 'Q5', rows: 1e5, store: 'postgresql', index: 'I1', cache: 'cold', unit: 'min', median: 1 },
      ],
    });
    const r = readMeasurements([{ name: '031-control-stage-1.md', text: md(b) }]);
    expect(r.points.map((p) => p.medianMs)).toEqual([500]);
    expect(r.counts.invalidPoints).toBe(1);
  });

  it('규칙 1 — NNN-{slug}.md 모양이 아닌 파일은 세지도 않는다', () => {
    const r = readMeasurements([
      { name: 'README.md', text: md(block()) },
      { name: '31-x.md', text: md(block()) },
      { name: '031_Control.md', text: md(block()) },
    ]);
    expect(r.counts.files).toBe(0);
    expect(r.points).toHaveLength(0);
  });

  it('규칙 2 — measurement/v1 블록이 0개 · 2개 이상 · 필수 필드 위반이면 판독 불가로 센다', () => {
    const noBlock = md('```json\n{"schema":"other"}\n```');
    const broken = md('```json\n{ not json\n```');
    const two = md(block(), block({ record: '032' }));
    const badRecord = md(block({ record: 31 }));
    const noRepeat = md(block({ repeat: undefined }));
    const r = readMeasurements([
      { name: '031-a.md', text: noBlock },
      { name: '032-b.md', text: broken },
      { name: '033-c.md', text: two },
      { name: '034-d.md', text: badRecord },
      { name: '035-e.md', text: noRepeat },
    ]);
    expect(r.counts.unreadable).toBe(5);
    expect(r.unreadableFiles).toEqual(['031-a.md', '032-b.md', '033-c.md', '034-d.md', '035-e.md']);
    expect(r.points).toHaveLength(0);
  });

  it('규칙 3 — discarded · superseded 기록과 다른 valid 기록이 supersedes로 가리킨 기록을 뺀다', () => {
    const r = readMeasurements([
      { name: '031-a.md', text: md(block({ record: '031' })) },
      { name: '032-b.md', text: md(block({ record: '032', status: 'discarded' })) },
      { name: '033-c.md', text: md(block({ record: '033', supersedes: '031', points: [] })) },
      { name: '034-d.md', text: md(block({ record: '034', status: 'superseded' })) },
    ]);
    expect(r.counts.excludedStatus).toBe(3);
    expect(r.points).toHaveLength(0);
  });

  it('규칙 3 — 폐기된 기록의 supersedes는 옛 기록을 빼지 않는다', () => {
    const r = readMeasurements([
      { name: '031-a.md', text: md(block({ record: '031' })) },
      { name: '032-b.md', text: md(block({ record: '032', status: 'discarded', supersedes: '031' })) },
    ]);
    expect(r.points.map((p) => p.record)).toEqual(['031', '031']);
  });

  it('규칙 4 — run 필드나 스위치 한 키(배열 원소 포함)가 null이면 4요소 누락으로 센다', () => {
    const r = readMeasurements([
      { name: '031-a.md', text: md(block({ record: '031', run: { ...RUN, capacityTier: null } })) },
      { name: '032-b.md', text: md(block({ record: '032', switches: { ...SWITCHES, 'SW-09': null } })) },
      {
        name: '033-c.md',
        text: md(block({ record: '033', switches: { ...SWITCHES, 'SW-09': ['on', null] } })),
      },
      { name: '034-d.md', text: md(block({ record: '034', switches: { ...SWITCHES, 'SW-11': undefined } })) },
      {
        name: '035-e.md',
        text: md(block({ record: '035', switches: { ...SWITCHES, 'SW-09': ['on', 'off'] } })),
      },
    ]);
    expect(r.counts.missingConditions).toBe(4);
    expect(new Set(r.points.map((p) => p.record))).toEqual(new Set(['035']));
  });

  it('규칙 4 — memoryLimitMb는 수 · null + memoryLimitSource면 충족, null 단독은 누락(10_observability/04 §조건 칸 2026-09-27)', () => {
    const SOURCE = 'cgroup max — datagen-d 서비스에 compose 상한 없음';
    const read = (run: Record<string, unknown>) =>
      readMeasurements([{ name: '031-a.md', text: md(block({ run })) }]);
    const num = read(RUN);
    expect(num.counts.missingConditions).toBe(0);
    expect(num.points[0]?.run).toEqual(RUN);
    expect(memoryLimitText(num.points[0]?.run as ControlPoint['run'])).toBe('4096 MB');
    const tool = read({ ...RUN, memoryLimitMb: null, memoryLimitSource: SOURCE });
    expect(tool.counts.missingConditions).toBe(0);
    expect(tool.points).toHaveLength(2);
    expect(tool.points[0]?.run).toEqual({ ...RUN, memoryLimitMb: null, memoryLimitSource: SOURCE });
    expect(memoryLimitText(tool.points[0]?.run as ControlPoint['run'])).toBe(SOURCE);
    for (const run of [
      { ...RUN, memoryLimitMb: null },
      { ...RUN, memoryLimitMb: null, memoryLimitSource: ' ' },
    ]) {
      const r = read(run);
      expect(r.counts.missingConditions).toBe(1);
      expect(r.points).toHaveLength(0);
    }
  });

  it('규칙 5 — 반복 3회 미만이거나 편차가 기준을 넘으면 뺀다', () => {
    const r = readMeasurements([
      {
        name: '031-a.md',
        text: md(block({ record: '031', repeat: { runs: 2, deviation: 0.01, threshold: 0.2 } })),
      },
      {
        name: '032-b.md',
        text: md(block({ record: '032', repeat: { runs: 3, deviation: 0.21, threshold: 0.2 } })),
      },
    ]);
    expect(r.counts.excludedDeviation).toBe(2);
    expect(r.points).toHaveLength(0);
  });

  it('규칙 6 — EXP-01~05를 인용하지 않은 기록의 points는 쓰지 않고 그 기록의 폐기 · 누락도 세지 않는다', () => {
    const r = readMeasurements([
      { name: '026-switch.md', text: md(block({ record: '026', exp: ['EXP-12'] })) },
      {
        name: '027-reg.md',
        text: md(block({ record: '027', exp: ['EXP-29'], run: { ...RUN, commitHash: null } })),
      },
      { name: '028-one.md', text: md(block({ record: '028', exp: ['EXP-03'] })) },
    ]);
    expect(r.counts).toMatchObject({ files: 3, control: 1, missingConditions: 0 });
    expect(new Set(r.points.map((p) => p.record))).toEqual(new Set(['028']));
  });

  it('규칙 7 — 모르는 필드는 무시한다', () => {
    const r = readMeasurements([
      { name: '031-a.md', text: md(block({ extraTopLevel: { x: 1 }, run: { ...RUN, cpuModel: 'x' } })) },
    ]);
    expect(r.counts.unreadable).toBe(0);
    expect(r.points).toHaveLength(2);
  });

  it('같은 (쿼리 · 행 · 저장소 · 변형 · 캐시) 점은 뒤 기록이 덮고 그 수를 센다', () => {
    const later = block({
      record: '040',
      points: [
        { query: 'Q1', rows: 1e6, store: 'postgresql', index: 'I1', cache: 'warm', unit: 'ms', median: 42 },
      ],
      axes: [],
    });
    const r = readMeasurements([
      { name: '040-b.md', text: md(later) },
      { name: '031-a.md', text: md(block()) },
    ]);
    expect(r.counts.duplicatePoints).toBe(1);
    expect(r.points.find((p) => p.store === 'postgresql')?.medianMs).toBe(42);
  });

  it('같은 (축 · 저장소 · 변형 · 행) 비교 축 값도 뒤 기록이 덮고 그 수를 센다(검수 #10)', () => {
    const later = block({
      record: '040',
      points: [],
      axes: [
        {
          axis: 'storage_bytes',
          store: 'postgresql',
          index: 'I1',
          rows: 1e6,
          value: 80_000_000,
          unit: 'bytes',
        },
      ],
    });
    const r = readMeasurements([
      { name: '040-b.md', text: md(later) },
      { name: '031-a.md', text: md(block()) },
    ]);
    expect(r.axes).toHaveLength(1);
    expect(r.axes[0]?.value).toBe(80_000_000);
    expect(r.counts.duplicatePoints).toBe(1);
  });
});

// ── 교차 판정 ──

function pt(
  store: 'postgresql' | 'clickhouse',
  rows: number,
  ms: number,
  over: Partial<ControlPoint> = {},
): ControlPoint {
  return {
    record: '031',
    run: RUN,
    switches: SWITCHES,
    query: 'Q1',
    rows,
    stage: null,
    store,
    index: store === 'postgresql' ? 'I1' : null,
    cache: 'warm',
    valuesMs: [ms, ms, ms],
    medianMs: ms,
    resultMatch: true,
    ...over,
  };
}
const sp = (p: ControlPoint): SeriesPoint => ({ rows: p.rows, medianMs: p.medianMs, point: p });

describe('findCrossover', () => {
  it('앞선 쪽이 바뀌는 첫 공통 단계에 표지 — 직전 단계를 함께 낸다', () => {
    const pg = [
      pt('postgresql', 1e5, 2),
      pt('postgresql', 1e6, 8),
      pt('postgresql', 1e7, 90),
      pt('postgresql', 1e8, 900),
    ].map(sp);
    const ch = [
      pt('clickhouse', 1e5, 5),
      pt('clickhouse', 1e6, 6),
      pt('clickhouse', 1e7, 7),
      pt('clickhouse', 1e8, 9),
    ].map(sp);
    expect(findCrossover(pg, ch)).toEqual({
      kind: 'crossed',
      rows: 1e6,
      prevRows: 1e5,
      before: 'postgresql',
      after: 'clickhouse',
    });
  });

  it('교차가 없으면 역전 없음과 관측 최대 행 수(두 저장소 공통)', () => {
    const pg = [pt('postgresql', 1e5, 20), pt('postgresql', 1e6, 30), pt('postgresql', 1e8, 50)].map(sp);
    const ch = [pt('clickhouse', 1e5, 5), pt('clickhouse', 1e6, 6)].map(sp);
    expect(findCrossover(pg, ch)).toEqual({ kind: 'none', maxRows: 1e6, leader: 'clickhouse' });
  });

  it('같음은 그 단계에서 교차한 것으로 본다 · 첫 단계가 같음이면 처음 앞선 쪽을 기준으로 삼는다', () => {
    const tieAt2 = findCrossover(
      [pt('postgresql', 1e5, 1), pt('postgresql', 1e6, 5)].map(sp),
      [pt('clickhouse', 1e5, 3), pt('clickhouse', 1e6, 5)].map(sp),
    );
    expect(tieAt2).toMatchObject({ kind: 'crossed', rows: 1e6, before: 'postgresql', after: 'tie' });
    const tieFirst = findCrossover(
      [pt('postgresql', 1e5, 5), pt('postgresql', 1e6, 4), pt('postgresql', 1e7, 9)].map(sp),
      [pt('clickhouse', 1e5, 5), pt('clickhouse', 1e6, 6), pt('clickhouse', 1e7, 7)].map(sp),
    );
    expect(tieFirst).toMatchObject({ kind: 'crossed', rows: 1e7, prevRows: 1e6, before: 'postgresql' });
  });

  it('공통 단계가 없으면 판정 불가', () => {
    expect(findCrossover([sp(pt('postgresql', 1e5, 1))], [sp(pt('clickhouse', 1e6, 1))])).toEqual({
      kind: 'insufficient',
    });
    expect(findCrossover([], [])).toEqual({ kind: 'insufficient' });
  });
});

describe('selectSeries', () => {
  const points = [
    pt('postgresql', 1e6, 40),
    pt('postgresql', 1e6, 12, { index: 'I2' }),
    pt('postgresql', 1e6, 90, { cache: 'cold' }),
    pt('postgresql', 1e5, 4, { query: 'Q2' }),
    pt('clickhouse', 1e6, 9),
    pt('clickhouse', 1e6, 11, { index: 'I2' }),
    pt('clickhouse', 1e5, 3),
  ];

  it('PostgreSQL은 고른 변형만 · ClickHouse는 변형 없는 점을 우선 · 행 수 오름차순', () => {
    const s = selectSeries(points, { query: 'Q1', index: 'I2', cache: 'warm' });
    expect(s.postgresql.map((x) => x.medianMs)).toEqual([12]);
    expect(s.clickhouse.map((x) => [x.rows, x.medianMs])).toEqual([
      [1e5, 3],
      [1e6, 9],
    ]);
  });

  it('캐시 상태 · 쿼리로 가른다', () => {
    const s = selectSeries(points, { query: 'Q1', index: 'I1', cache: 'cold' });
    expect(s.postgresql.map((x) => x.medianMs)).toEqual([90]);
    expect(s.clickhouse).toHaveLength(0);
  });
});

describe('formatRows', () => {
  it('격자 단계는 지수 표기', () => {
    expect(formatRows(1e5)).toBe('10^5');
    expect(formatRows(6e9)).toBe('6 × 10^9');
    expect(formatRows(12345)).toBe('12,345');
  });
});
