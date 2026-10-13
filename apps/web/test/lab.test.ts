// ⑤ 직접 비교 실험 판독 · compare 실행 규칙 — 정본 docs/08_screen/10_lab_screen.md §EXP-LAB
// 값은 통합 실측(2026-10-11 · 리드)의 api 결과 그대로다 — 지어낸 값이 아니다.
import { CARD_LINES, CARD_PROCESSES } from '@db-study/shared/src/card-line';
import { describe, expect, it } from 'vitest';
import { readCompareLatest } from '../components/lab/compare-latest';
import { ingestOption } from '../components/lab/ingest-option';
import {
  CONSISTENCY_CRITERIA,
  cardPointsPerSec,
  consistencyView,
  diskText,
  diskTimesText,
  finalResult,
  fingerprintCode,
  ingestLiveText,
  ingestSentence,
  ingestView,
  liveStepText,
  measuredAtText,
  type PartState,
  partState,
  periodText,
  QUERY_TERM,
  queryAvailable,
  queryTimes,
  queryView,
  sizeChoices,
  statsHead,
  sumText,
  withRun,
} from '../components/lab/lab-model';
import { logTick, queryOption, queryTooltipHtml } from '../components/lab/query-option';
import { ApiError } from '../lib/api';
import {
  compareLive,
  PANEL_IDLE,
  panelReducer,
  REFUSE_TEXT,
  requestStart,
  runScopeText,
  stepPlainText,
} from '../lib/runs';
import {
  COMPARE_INGEST_ROWS,
  type CompareLatestBodyType,
  type CompareLatestEntryBody,
  type CompareRunResultBody,
  type RunObjectBody,
} from '../lib/shared';

type R<P extends string> = Extract<CompareRunResultBody, { part: P }>;

const INGEST: R<'ingest'> = {
  part: 'ingest',
  target: 19_958_400,
  rangeStart: '2026-10-06T15:00:00.000Z',
  rangeEnd: '2026-10-07T15:00:00.000Z',
  inflightCompress: false,
  rows: { published: 19_958_400, clickhouse: 19_958_400, postgres: 19_958_400 },
  elapsedMs: 122_265,
  rowsPerSec: 163_239,
  batches: {
    count: 420,
    clickhouseMs: { p50: 85.45, p95: 131.9 },
    postgresMs: { p50: 195.6, p95: 244.56 },
    postgresFailures: 0,
  },
  bytes: { clickhouse: 52_470_028, postgres: 2_334_433_280 },
  timeline: [
    { tSec: 1, clickhouseMs: 102.34, postgresMs: 214.31, rows: 99_984 },
    { tSec: 2, clickhouseMs: 112.27, postgresMs: 215.57, rows: 249_972 },
  ],
};

type SizeRep = R<'query'>['sizes'][number]['clickhouse'];
const size = (
  target: number,
  [ts, deviceId, tagId]: [string, number, number],
  clickhouse: SizeRep,
  postgres: SizeRep,
  winner: 'clickhouse' | 'postgres' | null,
  ratio: number,
  over: Partial<Pick<R<'query'>['sizes'][number], 'match' | 'mismatchGroups'>> = {},
): R<'query'>['sizes'][number] => ({
  target,
  cut: { ts, deviceId, tagId },
  clickhouse,
  postgres,
  winner,
  ratio,
  match: true,
  mismatchGroups: 0,
  ...over,
});
const BLANK: SizeRep = { values: [], median: null, sourceRows: null, groups: null, checksum: null };
/** 넣은 데이터가 모자라 재지 않은 단계 */
const skipped = (target: number): R<'query'>['sizes'][number] => ({
  target,
  cut: null,
  clickhouse: BLANK,
  postgres: BLANK,
  winner: null,
  ratio: null,
  match: null,
  mismatchGroups: null,
});

// 원천 행 수 9단계(넣기 건수와 같은 스케일) 실측(2026-10-12 · 리드 — 5억 넣기(넣는 도중 압축) 뒤 · 노트북 Docker · api 결과 그대로).
// 5억 넣기에서 PostgreSQL이 COPY 시간 초과로 두 묶음(99,988행)을 잃어 5억 단계는 원천 행 수가 모자라고 칸 258개가 다르다 · 10억은 데이터가 모자라 못 잼.
const QUERY: R<'query'> = {
  part: 'query',
  rows: 500_000_000,
  rangeStart: '2026-08-21T00:00:00.000Z',
  rangeEnd: '2026-09-15T01:15:03.000Z',
  sizes: [
    size(
      100_000,
      ['2026-08-21T00:07:12.800Z', 3, 11],
      {
        values: [11.9, 13.16, 12.54],
        median: 12.54,
        sourceRows: 100_000,
        groups: 129,
        checksum: '110973997571',
      },
      {
        values: [11.31, 11.29, 11.2],
        median: 11.29,
        sourceRows: 100_000,
        groups: 129,
        checksum: '110973997571',
      },
      'postgres',
      1.11,
    ),
    size(
      1_000_000,
      ['2026-08-21T01:12:09.000Z', 1, 1],
      {
        values: [21.2, 22.35, 21.42],
        median: 21.42,
        sourceRows: 1_000_000,
        groups: 258,
        checksum: '1720328768840',
      },
      {
        values: [93.22, 95.55, 96.23],
        median: 95.55,
        sourceRows: 1_000_000,
        groups: 258,
        checksum: '1720328768840',
      },
      'clickhouse',
      4.46,
    ),
    size(
      5_000_000,
      ['2026-08-21T06:00:45.000Z', 2, 5],
      {
        values: [56.79, 55.45, 57.59],
        median: 56.79,
        sourceRows: 5_000_000,
        groups: 903,
        checksum: '23233528815260',
      },
      {
        values: [244.64, 246.41, 243.4],
        median: 244.64,
        sourceRows: 5_000_000,
        groups: 903,
        checksum: '23233528815260',
      },
      'clickhouse',
      4.31,
    ),
    size(
      10_000_000,
      ['2026-08-21T12:01:30.000Z', 3, 10],
      {
        values: [98.89, 104.03, 97.28],
        median: 98.89,
        sourceRows: 10_000_000,
        groups: 1_677,
        checksum: '83010207540602',
      },
      {
        values: [359.43, 359.53, 365.83],
        median: 359.53,
        sourceRows: 10_000_000,
        groups: 1_677,
        checksum: '83010207540602',
      },
      'clickhouse',
      3.64,
    ),
    size(
      30_000_000,
      ['2026-08-22T12:04:30.000Z', 7, 30],
      {
        values: [279.57, 304.35, 265.27],
        median: 279.57,
        sourceRows: 30_000_000,
        groups: 4_773,
        checksum: '687565574873318',
      },
      {
        values: [709.4, 710.46, 687.22],
        median: 709.4,
        sourceRows: 30_000_000,
        groups: 4_773,
        checksum: '687565574873318',
      },
      'clickhouse',
      2.54,
    ),
    size(
      50_000_000,
      ['2026-08-23T12:07:30.000Z', 12, 50],
      {
        values: [452.08, 459.62, 443.55],
        median: 452.08,
        sourceRows: 50_000_000,
        groups: 7_869,
        checksum: '1876815898978404',
      },
      {
        values: [1072.95, 1094.79, 1059.32],
        median: 1072.95,
        sourceRows: 50_000_000,
        groups: 7_869,
        checksum: '1876815898978404',
      },
      'clickhouse',
      2.37,
    ),
    size(
      100_000_000,
      ['2026-08-26T00:15:00.000Z', 24, 100],
      {
        values: [891.03, 907.01, 928.89],
        median: 907.01,
        sourceRows: 100_000_000,
        groups: 15_609,
        checksum: '7407996646853129',
      },
      {
        values: [2063.91, 2043.02, 2092.3],
        median: 2063.91,
        sourceRows: 100_000_000,
        groups: 15_609,
        checksum: '7407996646853129',
      },
      'clickhouse',
      2.28,
    ),
    size(
      500_000_000,
      ['2026-09-15T01:15:02.000Z', 9, 38],
      {
        values: [4539.8, 4473.95, 4470.73],
        median: 4473.95,
        sourceRows: 500_000_000,
        groups: 77_658,
        checksum: '183214113463415099',
      },
      {
        values: [10244.45, 10238.96, 10240.91],
        median: 10240.91,
        sourceRows: 499_900_012,
        groups: 77_658,
        checksum: '183167391728176677',
      },
      'clickhouse',
      2.29,
      { match: false, mismatchGroups: 258 },
    ),
    skipped(1_000_000_000),
  ],
};

// 5억 행 넣기 모양(2026-10-13 실측 값 바탕) — PostgreSQL이 COPY 시간 초과로 묶음 둘(99,988행)을 잃은 경우
const CONSISTENCY: R<'consistency'> = {
  part: 'consistency',
  rangeStart: '2026-08-21T00:00:00.000Z',
  rangeEnd: '2026-09-15T01:15:03.000Z',
  clickhouse: {
    rows: 500_000_000,
    sum: '183214113638572099',
    groups: 77_658,
    fingerprint: '-112689859973036359533035',
    scanMs: 25_638,
  },
  postgres: {
    rows: 499_900_012,
    sum: '183214077129456321',
    groups: 77_658,
    fingerprint: '-112689859973041122334455',
    scanMs: 125_420,
  },
  checks: { rows: false, sum: false, groups: false, fingerprint: false },
  mismatchGroups: 258,
  diffGroups: 258,
  mismatches: [
    {
      deviceId: 1,
      tagId: 2,
      label: 'L1-PRT 인쇄 · 잉크 온도',
      hour: '2026-08-29T23:00:00.000Z',
      clickhouse: 3_600,
      postgres: 1_440,
    },
    {
      deviceId: 1,
      tagId: 3,
      label: null,
      hour: '2026-08-29T23:00:00.000Z',
      clickhouse: null,
      postgres: 36_000,
    },
    {
      deviceId: 1,
      tagId: 4,
      label: 'L1-PRT 인쇄 · 속도',
      hour: '2026-08-29T23:00:00.000Z',
      clickhouse: 36_000,
      postgres: 14_400,
    },
  ],
  match: false,
};

const entry = (result: CompareRunResultBody | null, over: Partial<CompareLatestEntryBody> = {}) =>
  ({
    runId: '00000000-0000-4000-8000-000000000001',
    status: 'completed',
    params: { part: result?.part ?? 'ingest', rows: 1_000_000 },
    result,
    startedAt: '2026-10-11T09:40:09.418Z',
    endedAt: '2026-10-11T09:41:15.084Z',
    commitHash: null,
    switches: { 'SW-09': 'gated' },
    plantOn: false,
    ...over,
  }) as CompareLatestEntryBody;

const NO_ATTEMPTS: CompareLatestBodyType['attempts'] = { ingest: null, query: null, consistency: null };
const body = (over: Partial<CompareLatestBodyType> = {}): CompareLatestBodyType => ({
  ingest: null,
  query: null,
  consistency: null,
  attempts: NO_ATTEMPTS,
  ...over,
});
const attempt = (status: 'completed' | 'stopped' | 'failed', endedAt: string) => ({
  runId: '00000000-0000-4000-8000-000000000009',
  status,
  endedAt,
});

describe('부분별 상태', () => {
  it('읽기 중 · 읽기 실패 · 없음 · 이 부분만 계약과 다름 · 결과', () => {
    expect(partState(undefined, false, 'ingest').kind).toBe('loading');
    expect(partState(undefined, true, 'ingest').kind).toBe('failed');
    expect(partState({ body: body(), failed: [] }, false, 'query')).toEqual({ kind: 'none', attempt: null });
    expect(partState({ body: body(), failed: ['consistency'] }, false, 'consistency').kind).toBe('failed');
    const ok = partState({ body: body({ ingest: entry(INGEST) }), failed: [] }, false, 'ingest');
    expect(ok).toMatchObject({ kind: 'ok', attempt: null });
  });

  it('마지막 시도가 완료 결과보다 뒤에 중단 · 실패 → 그 전 완료 결과 + 한 줄(넣기는 다시 넣기 안내)', () => {
    const later = '2026-10-11T10:00:00.000Z';
    const q = partState(
      {
        body: body({ query: entry(QUERY), attempts: { ...NO_ATTEMPTS, query: attempt('stopped', later) } }),
        failed: [],
      },
      false,
      'query',
    );
    expect(q).toMatchObject({ kind: 'ok', attempt: { status: 'stopped', text: '마지막 시도는 중단됐어요' } });
    const i = partState(
      {
        body: body({ ingest: entry(INGEST), attempts: { ...NO_ATTEMPTS, ingest: attempt('failed', later) } }),
        failed: [],
      },
      false,
      'ingest',
    );
    expect(i).toMatchObject({ kind: 'ok', attempt: { text: '마지막 시도는 실패했어요 — 다시 넣어 주세요' } });
    // 완료 결과가 없고 멈춘 시도만
    expect(
      partState(
        { body: body({ attempts: { ...NO_ATTEMPTS, consistency: attempt('stopped', later) } }), failed: [] },
        false,
        'consistency',
      ),
    ).toMatchObject({ kind: 'none', attempt: { status: 'stopped' } });
  });

  it('마지막 시도가 그 완료 결과 자신이거나 더 앞이면 한 줄 없음', () => {
    const own = attempt('completed', '2026-10-11T09:41:15.084Z');
    const earlier = attempt('stopped', '2026-10-11T09:00:00.000Z');
    for (const a of [own, earlier])
      expect(
        partState(
          { body: body({ query: entry(QUERY), attempts: { ...NO_ATTEMPTS, query: a } }), failed: [] },
          false,
          'query',
        ),
      ).toMatchObject({ kind: 'ok', attempt: null });
  });

  it('옛 api — 부분별 최근 1건이 중단이면 결과 없는 시도로 읽는다', () => {
    const stopped = partState(
      { body: body({ query: entry(null, { status: 'stopped' }) }), failed: [] },
      false,
      'query',
    );
    expect(stopped).toMatchObject({
      kind: 'none',
      attempt: { status: 'stopped', text: '마지막 시도는 중단됐어요' },
    });
  });

  it('응답 읽기 — 부분마다 따로 검사 · attempts가 없거나(옛 api) 모양이 다르면 null', () => {
    const r = readCompareLatest({
      ingest: entry(INGEST),
      query: { nope: 1 },
      consistency: null,
      attempts: { ingest: attempt('stopped', '2026-10-11T10:00:00.000Z'), query: { bad: true } },
    });
    expect(r.failed).toEqual(['query']);
    expect(r.body.ingest?.runId).toBe(entry(INGEST).runId);
    expect(r.body.attempts).toEqual({
      ingest: attempt('stopped', '2026-10-11T10:00:00.000Z'),
      query: null,
      consistency: null,
    });
    expect(readCompareLatest({ ingest: null, query: null, consistency: null }).body.attempts).toEqual(
      NO_ATTEMPTS,
    );
    expect(() => readCompareLatest(null)).toThrow();
  });

  it('잰 시각은 KST "월/일 시:분에 잼"', () => {
    expect(measuredAtText({ endedAt: '2026-10-11T09:41:15.084Z' })).toBe('10/11 18:41에 잼');
  });
});

describe('머리 — 지금 쌓인 비교 데이터', () => {
  const STATS = {
    at: '2026-10-11T12:01:51.634Z',
    clickhouse: { rows: 20_096_972, bytes: 52_920_167 },
    postgres: { rows: 19_958_400, bytes: 3_158_327_296 },
    redis: { streamLength: 0, latestKeys: 30 },
    compareRange: { start: '2026-10-06T15:00:00.000Z', end: '2026-10-07T15:00:00.000Z' },
    compareRows: { clickhouse: 19_958_400, postgres: 19_958_400 },
  };

  it('비교 구간 행 수(CH · PG) · 원본 전체(가동 데이터 포함)와 구간은 툴팁', () => {
    const h = statsHead(STATS);
    expect(h.rows).toEqual({ ch: '1,996만 행', pg: '1,996만 행' });
    expect(h.tip).toContain('비교 구간 2026-10-07 00:00 ~ 10-08 00:00 KST — ClickHouse 19,958,400행');
    expect(h.tip).toContain('ClickHouse(tag_raw · 설비 가동 데이터 포함) 20,096,972행');
    expect(h.tip).toContain('PostgreSQL 비교 사본(plc_tag_raw_control) 19,958,400행');
  });

  it('비교 구간이 없으면(넣기 전 · 지운 뒤) 행 수 없음', () => {
    const h = statsHead({ ...STATS, compareRange: null, compareRows: null });
    expect(h.rows).toBeNull();
    expect(h.tip).toContain('비교 구간 없음');
  });
});

describe('① 넣기', () => {
  it('카드 라인 명목 초당 점 — 공정 10 태그 주기 합 × 라인 수', () => {
    const perLine = CARD_PROCESSES.reduce(
      (a, p) => a + p.tags.reduce((b, t) => b + 1000 / t.scanRateMs, 0),
      0,
    );
    expect(cardPointsPerSec()).toBeCloseTo(perLine * CARD_LINES.length, 9);
  });
  it('건수 선택지 — 10만 ~ 10억 · 기간은 건수 ÷ 카드 라인 명목 초당 점(231) · 시간은 지난 실측 속도로만', () => {
    const none = sizeChoices(COMPARE_INGEST_ROWS, null);
    expect(none.map((c) => [c.name, c.period, c.took])).toEqual([
      ['10만 행', '7분치', null],
      ['100만 행', '1.2시간치', null],
      ['500만 행', '6시간치', null],
      ['1,000만 행', '12시간치', null],
      ['3,000만 행', '1.5일치', null],
      ['5,000만 행', '2.5일치', null],
      ['1억 행', '5일치', null],
      ['5억 행', '25일치', null],
      ['10억 행', '50일치', null],
    ]);
    // 2026-10-12 사흘치 실측 속도(초당 161,622행)
    const timed = sizeChoices(COMPARE_INGEST_ROWS, 161_622);
    expect(timed.map((c) => c.took)).toEqual([
      '약 1s',
      '약 6s',
      '약 31s',
      '약 1m',
      '약 3m',
      '약 5m',
      '약 10m',
      '약 52m',
      '약 1.7h',
    ]);
    expect([periodText(59), periodText(3_599), periodText(86_400), periodText(43 * 86_400)]).toEqual([
      '1분치',
      '60분치',
      '1일치',
      '43일치',
    ]);
  });

  it('디스크 크기 글자는 유효숫자 3자리 · 배수는 10배 미만 소수 두 자리 — 화면의 두 크기로 나눠도 배수 글자와 맞는다', () => {
    // 2026-10-12 사흘치 실측(TimescaleDB 압축 뒤) — CH 157,333,252 · PG 211,853,312 바이트
    expect([diskText(157_333_252), diskText(211_853_312)]).toEqual(['157MB', '212MB']);
    expect(diskTimesText(211_853_312 / 157_333_252)).toBe('1.35'); // 212 ÷ 157 = 1.35
    expect([diskText(52_470_028), diskText(2_334_433_280), diskText(1_234), diskText(999)]).toEqual([
      '52.5MB',
      '2.33GB',
      '1.23KB',
      '999B',
    ]);
    expect(diskTimesText(2_334_433_280 / 52_470_028)).toBe('44'); // 2.33GB ÷ 52.5MB = 44.4
    const v = ingestView({ ...INGEST, bytes: { clickhouse: 157_333_252, postgres: 211_853_312 } });
    expect(v.disk).toMatchObject({ chText: '157MB', pgText: '212MB', times: '1.35배' });
    expect(ingestSentence(v)).toBe('두 DB에 똑같이 들어갔어요 · 디스크는 ClickHouse가 1.35배 작아요');
  });

  it('행 수 대조 · 걸린 시간 · 초당 · 디스크 배수 · 결론(사실대로)', () => {
    const v = ingestView(INGEST);
    expect(v.same).toBe(true);
    expect(v.rows).toBe('1,996만 행');
    expect(v.took).toBe('122s');
    expect(v.perSec).toBe('16만행');
    expect(v.span).toBe('1일치');
    expect(v.inflight).toBe(false);
    expect(v.disk).toMatchObject({ chText: '52.5MB', pgText: '2.33GB', times: '44배' });
    expect(v.batch.ch.p50).toBe('85.5');
    expect(v.batch.pg.p50).toBe('196');
    expect(ingestSentence(v)).toBe('두 DB에 똑같이 들어갔어요 · 디스크는 ClickHouse가 44배 작아요');
    const diff = ingestView({ ...INGEST, rows: { ...INGEST.rows, postgres: 19_958_000 } });
    expect(diff.same).toBe(false);
    expect(ingestSentence(diff)).toContain('행 수가 달라요');
  });

  it('그림 옵션 — 선 2(CH 주황 · PG 파랑) · 축 하나(0부터) · 선 끝 글자', () => {
    const o = ingestOption(ingestView(INGEST), { font: 12, width: 400, height: 160 }) as unknown as {
      series: { name: string; color: string; data: unknown[]; endLabel: { show: boolean } }[];
      yAxis: { min: number };
    };
    expect(o.series.map((s) => [s.name, s.color])).toEqual([
      ['ClickHouse', '#d97706'],
      ['PostgreSQL', '#2563eb'],
    ]);
    expect(o.series[0]?.data).toEqual([
      [1, 102.34],
      [2, 112.27],
    ]);
    expect(o.yAxis.min).toBe(0);
    expect(o.series.every((s) => s.endLabel.show)).toBe(true);
  });
});

describe('② 조회 대결 — 원천 행 수 9단계 꺾은선 · 점을 가리키면 두 시간 · 차이만', () => {
  it('단계마다 판정 — 빠른 쪽 배수(보이는 두 숫자로) · 축 글자는 앞 칸과 같은 쪽이면 이름을 뺀다 · 못 잰 단계 한 줄(5억 넣기 실측)', () => {
    const v = queryView(QUERY, null);
    expect(v.points.map((p) => [p.name, p.phase, p.chText, p.pgText, p.mark])).toEqual([
      ['10만', 'done', '12.5ms', '11.3ms', 'PG 1.1배 빠름'],
      ['100만', 'done', '21.4ms', '95.5ms', 'CH 4.5배 빠름'],
      ['500만', 'done', '56.8ms', '245ms', 'CH 4.3배 빠름'],
      ['1,000만', 'done', '98.9ms', '360ms', 'CH 3.6배 빠름'],
      ['3,000만', 'done', '280ms', '709ms', 'CH 2.5배 빠름'],
      ['5,000만', 'done', '0.452s', '1.07s', 'CH 2.4배 빠름'],
      ['1억', 'done', '0.907s', '2.06s', 'CH 2.3배 빠름'],
      ['5억', 'done', '4.47s', '10.2s', 'CH 2.3배 빠름'],
      ['10억', 'skipped', null, null, '못 잼'],
    ]);
    expect(v.points.map((p) => p.axis)).toEqual([
      'PG 1.1배',
      'CH 4.5배',
      '4.3배',
      '3.6배',
      '2.5배',
      '2.4배',
      '2.3배',
      '2.3배',
      '못 잼',
    ]);
    expect(v.points[0]).toMatchObject({ ch: 12.54, pg: 11.29, faster: 'pg', times: '1.1' });
    expect(v.measured).toBe(8);
    expect(v.skipped).toBe(
      '10억 행은 넣은 데이터(5.0억 행)보다 많아 못 쟀어요 — 10억 행 이상 넣으면 다 재요',
    );
    expect(v.running).toBeNull();
    // 점을 가리키면 — 단계 · 두 시간 · 차이 네 줄뿐(데이터 비교는 ③ 데이터 정합성 몫 · 5억 단계 PostgreSQL 원천 부족도 여기서 말하지 않는다)
    expect(v.points[6]?.tip.split('\n')).toEqual([
      '원천 1억 행',
      'ClickHouse 0.907s',
      'PostgreSQL 2.06s',
      'CH 2.3배 빠름',
    ]);
    expect(v.points[7]?.tip).not.toContain('원천 행 수');
    expect(v.points[8]?.tip).toBe('원천 10억 행\n넣은 데이터(5.0억 행)보다 많아 못 쟀어요');
  });

  it('보이는 두 숫자를 손으로 나누면 차이 글자와 같다 — 단위 경계(1초) · 100 이상 정수 · 같아 보이면 빠른 쪽 없음', () => {
    expect(queryTimes(999.4, 120)).toEqual({ ch: '999ms', pg: '120ms', faster: 'pg', times: '8.3' });
    expect(queryTimes(1000, 120)).toEqual({ ch: '1s', pg: '0.12s', faster: 'pg', times: '8.3' });
    expect(queryTimes(20_512, 123_456)).toEqual({ ch: '20.5s', pg: '123s', faster: 'ch', times: '6.0' });
    expect(queryTimes(12.54, 12.51)).toEqual({
      ch: '12.5ms',
      pg: '12.5ms',
      faster: null,
      times: null,
    });
    expect(queryTimes(3, 45)).toMatchObject({ faster: 'ch', times: '15' });
  });

  it('"비슷" — 3번이 엇갈리면(api 승자 없음) · 3번 모두 같은 쪽이 빨라도 보이는 배수가 1.0배면', () => {
    const base = QUERY.sizes[0];
    if (!base) throw new Error('fixture');
    const [split] = queryView({ ...QUERY, sizes: [{ ...base, winner: null }] }, null).points;
    expect(split).toMatchObject({ faster: null, mark: '비슷', axis: '비슷' });
    const [even] = queryView(
      { ...QUERY, sizes: [{ ...base, postgres: { ...base.postgres, median: 12.2 } }] },
      null,
    ).points;
    expect(even).toMatchObject({ chText: '12.5ms', pgText: '12.2ms', faster: null, mark: '비슷' });
    expect(even?.tip.split('\n')).toEqual(['원천 10만 행', 'ClickHouse 12.5ms', 'PostgreSQL 12.2ms', '비슷']);
  });

  it('1억만 넣었으면 — 5억 · 10억은 못 잼(cut null) · 안내 한 줄은 범위로', () => {
    const v = queryView(
      {
        ...QUERY,
        rows: 100_000_000,
        sizes: [...QUERY.sizes.slice(0, 7), skipped(500_000_000), skipped(1_000_000_000)],
      },
      null,
    );
    expect(v.points.map((p) => p.phase).slice(-3)).toEqual(['done', 'skipped', 'skipped']);
    expect(v.points.slice(-2).map((p) => [p.mark, p.ch, p.pg])).toEqual([
      ['못 잼', null, null],
      ['못 잼', null, null],
    ]);
    expect(v.measured).toBe(7);
    expect(v.skipped).toBe(
      '5억~10억 행은 넣은 데이터(1.0억 행)보다 많아 못 쟀어요 — 10억 행 이상 넣으면 다 재요',
    );
  });

  it('그림 — 가로 9칸(단계 이름 + 판정 글자) · 세로 로그 · 끝난 단계만 점 · 값이 없으면 눈금 글자 없는 빈 축', () => {
    type Axis = {
      type: string;
      min?: number;
      max?: number;
      data?: string[];
      axisLabel: { show?: boolean; formatter: (v: never, i: number) => string };
    };
    const o = (v: ReturnType<typeof queryView>) =>
      queryOption(v, { font: 12, width: 500, height: 200 }) as unknown as {
        xAxis: Axis;
        yAxis: Axis;
        tooltip: { trigger: string; formatter: (ps: unknown) => string };
        series: { name: string; color: string; data: (number | null)[]; endLabel: { show: boolean } }[];
      };
    const full = o(queryView(QUERY, null));
    expect(full.xAxis.data).toEqual([
      '10만',
      '100만',
      '500만',
      '1,000만',
      '3,000만',
      '5,000만',
      '1억',
      '5억',
      '10억',
    ]);
    expect(full.yAxis).toMatchObject({ type: 'log', axisLabel: { show: true } });
    expect(full.yAxis.min).toBeUndefined();
    expect(full.series.map((s) => [s.name, s.color])).toEqual([
      ['ClickHouse', '#d97706'],
      ['PostgreSQL', '#2563eb'],
    ]);
    expect(full.series[1]?.data.slice(0, 2)).toEqual([11.29, 95.55]);
    expect(full.series[1]?.data.at(-1)).toBeNull(); // 10억 — 못 잼
    expect(full.series.every((s) => s.endLabel.show)).toBe(true);
    // 축 글자 — 단계 이름 + 빠른 쪽 색 판정(rich)
    expect(full.xAxis.axisLabel.formatter('10만' as never, 0)).toBe('10만\n{pg|PG 1.1배}');
    expect(full.xAxis.axisLabel.formatter('100만' as never, 1)).toBe('100만\n{ch|CH 4.5배}');
    expect(full.xAxis.axisLabel.formatter('5억' as never, 7)).toBe('5억\n{ch|2.3배}');
    expect(full.xAxis.axisLabel.formatter('10억' as never, 8)).toBe('10억\n{mute|못 잼}');
    // 점을 가리키면(축 단위 툴팁) — 그 단계의 네 줄 · 저장소 색 점 · 차이는 빠른 쪽 색
    expect(full.tooltip.trigger).toBe('axis');
    const tip = full.tooltip.formatter([{ dataIndex: 6 }]);
    expect(tip.split('<br/>')).toHaveLength(4);
    expect(tip).toContain('<b>원천 1억 행</b>');
    expect(tip).toContain('ClickHouse <b style="font-variant-numeric:tabular-nums">0.907s</b>');
    expect(tip).toContain('PostgreSQL <b style="font-variant-numeric:tabular-nums">2.06s</b>');
    expect(tip).toContain('<b style="color:#b45309">CH 2.3배 빠름</b>');
    expect(full.tooltip.formatter([{ dataIndex: 8 }])).toBe(
      '<b>원천 10억 행</b><br/>넣은 데이터(5.0억 행)보다 많아 못 쟀어요',
    );
    expect(queryTooltipHtml(undefined)).toBe('');

    const empty = o(queryView(null, [{ key: 'prepare', status: 'running', detail: {} }]));
    expect(empty.yAxis).toMatchObject({ min: 1, max: 1000, axisLabel: { show: false } });
    expect(empty.series[0]?.data.every((x) => x === null)).toBe(true);
    expect(empty.xAxis.axisLabel.formatter('10만' as never, 0)).toBe('10만\n{mute| }');
  });

  it('세로 눈금 — 1,000밀리초부터 초 · 그 아래는 숫자만 · 칸 이름 옆 글자는 단계 처음 ~ 끝', () => {
    expect([0.5, 1, 10, 100, 1000, 10_000].map(logTick)).toEqual(['0.5', '1', '10', '100', '1s', '10s']);
    expect(QUERY_TERM).toBe('원천 10만 ~ 10억 행 집계');
  });
});

describe('③ 데이터 정합성 — 기준 4줄 표(기준 · PostgreSQL · ClickHouse · 판정)', () => {
  const step = (key: string, status: RunObjectBody['steps'][number]['status']) => ({
    key,
    status,
    detail: {},
  });
  it('빠진 행 — 결론 · 기준 순서 · 두 저장소 값 · 판정 글 · 다른 곳 앞 두 개 + 나머지 수 · 잰 구간 · 걸린 시간', () => {
    const v = consistencyView(CONSISTENCY, null);
    expect(v.match).toBe(false);
    expect(v.headline).toBe('4가지 모두 달라요 — PostgreSQL에 99,988행이 적어요');
    expect(v.rows.map((x) => [x.name, x.pg.text, x.ch.text, x.same, x.verdict, x.detail])).toEqual([
      ['행 수', '499,900,012행', '500,000,000행', false, '다름', 'PG 99,988행 적음'],
      ['값 합계', '183,214,077,129,456.321', '183,214,113,638,572.099', false, '다름', '차이 36,509,115.778'],
      ['묶음 집계', '77,658묶음', '77,658묶음', false, '다름', '258묶음 다름'],
      ['행 지문', '6559-A909', '813C-3E15', false, '다름', '행 내용이 달라요'],
    ]);
    expect(v.rows.every((x) => x.pg.phase === 'done' && x.ch.phase === 'done')).toBe(true);
    expect(v.where).toBe('다른 곳 258묶음 — L1-PRT 인쇄 · 잉크 온도 8/30 8시(PG 2,160행 적음) 등');
    // 이름이 없는 묶음 · 한쪽에만 있는 묶음
    expect(consistencyView({ ...CONSISTENCY, mismatches: CONSISTENCY.mismatches.slice(1) }, null).where).toBe(
      '다른 곳 258묶음 — 설비 1 · 태그 3 8/30 8시(CH에 없음) 등',
    );
    expect(v.foot).toBe('잰 구간 8/21 09:00 ~ 9/15 10:15 · 다 훑는 데 PG 125s · CH 26s');
    // 칸 툴팁 — 판정에 쓰는 전체 값(지문 칸은 끝 8자리만 보인다)
    expect(v.rows[3]?.ch.tip).toContain('-112,689,859,973,036,359,533,035');
  });

  it('같으면 "4가지 기준이 모두 같아요" · 다른 곳 없음 · 품질만 다르면 행 지문만 다름 · 행 수는 같은데 내용이 달라요', () => {
    const ch = CONSISTENCY.clickhouse as NonNullable<typeof CONSISTENCY.clickhouse>;
    const at = CONSISTENCY.mismatches[0] as (typeof CONSISTENCY.mismatches)[number];
    const same = consistencyView(
      {
        ...CONSISTENCY,
        postgres: { ...ch, scanMs: 125_420 },
        checks: { rows: true, sum: true, groups: true, fingerprint: true },
        mismatchGroups: 0,
        diffGroups: 0,
        mismatches: [],
        match: true,
      },
      null,
    );
    expect(same.headline).toBe('4가지 기준이 모두 같아요 — 두 DB에 똑같이 들어갔어요');
    expect(same.rows.map((x) => [x.verdict, x.detail])).toEqual(Array(4).fill(['같음', null]));
    expect(same.where).toBeNull();
    const quality = consistencyView(
      {
        ...CONSISTENCY,
        postgres: { ...ch, fingerprint: '17' },
        checks: { rows: true, sum: true, groups: true, fingerprint: false },
        mismatchGroups: 0,
        diffGroups: 1,
        mismatches: [{ ...at, postgres: 3_600 }],
        match: false,
      },
      null,
    );
    expect(quality.headline).toBe('4가지 중 1가지가 달라요 — 행 수는 같은데 내용이 달라요');
    expect(quality.rows.map((x) => x.same)).toEqual([true, true, true, false]);
    expect(quality.where).toBe('다른 곳 1묶음 — L1-PRT 인쇄 · 잉크 온도 8/30 8시(내용 다름)');
  });

  it('재는 중 — ClickHouse만 다 잼: CH 칸 값 · PG 칸 지금 재는 중 · 판정 · 결론은 아직 · 구간 확인 중이면 모두 기다리는 중', () => {
    const steps = [step('prepare', 'done'), step('clickhouse', 'done'), step('postgres', 'running')];
    const v = consistencyView(
      {
        ...CONSISTENCY,
        postgres: null,
        checks: null,
        mismatchGroups: null,
        diffGroups: null,
        mismatches: [],
        match: null,
      },
      steps,
    );
    expect(v.match).toBeNull();
    expect(v.headline).toBeNull();
    expect(v.rows.map((x) => [x.ch.phase, x.pg.phase, x.same, x.verdict])).toEqual(
      Array(4).fill(['done', 'running', null, '']),
    );
    expect(v.rows[0]?.pg.text).toBe('재는 중…');
    expect(v.foot).toBe('잰 구간 8/21 09:00 ~ 9/15 10:15 · 다 훑는 데 CH 26s');
    const first = consistencyView(null, [step('prepare', 'running')]);
    expect(first.rows.map((x) => [x.ch.text, x.pg.text])).toEqual(
      Array(4).fill(['기다리는 중', '기다리는 중']),
    );
    expect(first.foot).toBe('');
  });

  it('값 합계 글자는 ÷ 1000 소수 셋째 자리 그대로 · 지문 칸은 끝 32비트 16진 8자리', () => {
    expect(sumText('183214113638572099')).toBe('183,214,113,638,572.099');
    expect(sumText('-370')).toBe('-0.370');
    expect(sumText(5n)).toBe('0.005');
    expect(fingerprintCode('17')).toBe('0000-0011');
    expect(fingerprintCode('-1')).toBe('FFFF-FFFF');
    expect(CONSISTENCY_CRITERIA.map((c) => `${c.name}(${c.term})`)).toEqual([
      '행 수(count)',
      '값 합계(sum)',
      '묶음 집계(GROUP BY)',
      '행 지문(MD5)',
    ]);
  });
});

describe('compare 실행 규칙(lib/runs)', () => {
  const run = (over: Partial<RunObjectBody>): RunObjectBody => ({
    runId: '00000000-0000-4000-8000-000000000002',
    type: 'compare',
    status: 'running',
    params: { part: 'ingest', rows: 50_000_000 },
    startedAt: '2026-10-11T10:00:00.000Z',
    endedAt: null,
    elapsedMs: 3_000,
    steps: [
      {
        key: 'prepare',
        label: '구간 · 태그 준비',
        status: 'done',
        startedAt: null,
        endedAt: null,
        elapsedMs: 5,
        detail: {},
      },
      {
        key: 'publish',
        label: 'Redis로 발행',
        status: 'running',
        startedAt: null,
        endedAt: null,
        elapsedMs: 2_000,
        detail: { published: 500_000, rowsCh: 400_000, rowsPg: 390_000, progress: 0.025 },
      },
    ],
    result: null,
    error: null,
    ...over,
  });

  it('무엇을 잰 실행인지 — 넣기 하루치 · 조회 대결 · 데이터 정합성', () => {
    expect(runScopeText(run({}))).toBe('직접 비교 넣기 5,000만 행');
    expect(runScopeText(run({ params: { part: 'query', rows: 1_000_000 } }))).toBe('직접 비교 조회 대결');
    expect(runScopeText(run({ params: { part: 'consistency', rows: 1_000_000 } }))).toBe(
      '직접 비교 데이터 정합성',
    );
    // 옛 실행(업무 방해 · 무결성 — 삭제)은 부분 이름을 모르므로 범위 글자를 내지 않는다
    expect(runScopeText(run({ params: { part: 'interfere', rows: 1_000_000 } }))).toBeNull();
    expect(runScopeText(run({ params: { part: 'integrity', rows: 1_000_000 } }))).toBeNull();
    expect(runScopeText({ type: 'flow', params: { pps: 1000, durationSec: 30 } })).toBe('초당 1,000개 · 30s');
  });

  it('단계 쉬운 문장 · 넣기 진행(보낸 행 ÷ 구간)', () => {
    expect(stepPlainText(run({}))).toBe('Redis로 보내는 중');
    expect(
      stepPlainText(
        run({
          steps: [
            {
              key: 'postgres',
              label: 'x',
              status: 'running',
              startedAt: null,
              endedAt: null,
              elapsedMs: 0,
              detail: {},
            },
          ],
        }),
      ),
    ).toBe('PostgreSQL에서 재는 중');
    // 조회 대결 — 원천 행 수 단계(rows-N)
    const sizeStep = (key: string) =>
      stepPlainText(
        run({
          params: { part: 'query', rows: 1_000_000 },
          steps: [
            { key, label: 'x', status: 'running', startedAt: null, endedAt: null, elapsedMs: 0, detail: {} },
          ],
        }),
      );
    expect(sizeStep('rows-100000')).toBe('원천 10만 행 집계하는 중');
    expect(sizeStep('rows-50000000')).toBe('원천 5,000만 행 집계하는 중');
    expect(sizeStep('rows-1000000000')).toBe('원천 10억 행 집계하는 중');
    // 옛 단계(1만 — 넣기 건수와 같은 스케일 전)는 모르는 단계
    expect(sizeStep('rows-10000')).toBe('진행 중');
    expect(compareLive(run({}))).toEqual({
      part: 'ingest',
      ratio: 0.025,
      published: 500_000,
      rowsCh: 400_000,
      rowsPg: 390_000,
    });
    expect(compareLive(run({ type: 'flow' }))).toBeNull();
  });

  it('시작 거절 — 409 compare_no_data · 400 SW-09 off는 순서 · 설정 문구(고른 값 문제가 아니다)', async () => {
    const reply = (status: number, b: unknown) => async () =>
      new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
    const noData = await requestStart(
      'compare',
      { part: 'query' },
      reply(409, { error: { code: 'datagen.compare_no_data', message: 'x' } }),
    );
    expect(noData).toMatchObject({ kind: 'refused', reason: 'no_data' });
    const sinkOff = await requestStart(
      'compare',
      { part: 'ingest', rows: 1_000_000 },
      reply(400, {
        error: {
          code: 'common.validation_failed',
          message: 'x',
          details: { fields: [{ path: 'SW-09', reason: 'enum' }] },
        },
      }),
    );
    expect(sinkOff).toMatchObject({ kind: 'refused', reason: 'sink_off' });
    const invalid = await requestStart(
      'compare',
      { part: 'ingest', rows: 7 },
      reply(400, {
        error: {
          code: 'common.validation_failed',
          message: 'x',
          details: { fields: [{ path: 'params.rows', reason: 'enum' }] },
        },
      }),
    );
    expect(invalid.kind).toBe('invalid');
    const s = panelReducer(
      { ...PANEL_IDLE, starting: true },
      {
        kind: 'start-done',
        outcome: { kind: 'refused', reason: 'no_data', error: new ApiError(409, null, 'x') },
        self: 'compare',
      },
    );
    expect(s).toMatchObject({ starting: false, notice: { tone: 'info', text: REFUSE_TEXT.no_data } });
    expect(REFUSE_TEXT.no_data).toContain('먼저 ① 넣기');
  });
});

describe('실시간 — 재는 중인 패널만 중간 결과로 새로 그린다(사용자 결정 2026-10-11)', () => {
  const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
  const step = (key: string, status: RunObjectBody['steps'][number]['status'], detail = {}) => ({
    key,
    label: key,
    status,
    startedAt: null,
    endedAt: null,
    elapsedMs: null,
    detail,
  });
  const live = (over: Partial<RunObjectBody>): RunObjectBody => ({
    runId: RUN_ID,
    type: 'compare',
    status: 'running',
    params: { part: 'ingest', rows: 1_000_000 },
    startedAt: '2026-10-11T10:00:00.000Z',
    endedAt: null,
    elapsedMs: 3_000,
    steps: [],
    result: null,
    error: null,
    ...over,
  });
  const KEPT = {
    body: body({ ingest: entry(INGEST), query: entry(QUERY), consistency: entry(CONSISTENCY) }),
    failed: [],
  };
  const kept = <P extends 'ingest' | 'query' | 'consistency'>(p: P) => partState(KEPT, false, p);

  // 넣는 중 중간값 — 발행 3초째(두 DB가 서로 다른 게 정상) · 크기는 아직 없음
  const MID: R<'ingest'> = {
    ...INGEST,
    target: 1_000_000,
    rows: { published: 420_000, clickhouse: 400_000, postgres: 390_000 },
    elapsedMs: 3_000,
    rowsPerSec: 130_000,
    batches: {
      count: 12,
      clickhouseMs: { p50: 90.2, p95: null },
      postgresMs: { p50: 201.4, p95: null },
      postgresFailures: 0,
    },
    bytes: { clickhouse: null, postgres: null },
    timeline: INGEST.timeline,
  };

  describe('패널 상태 겹치기(withRun)', () => {
    it('실행이 없거나 다른 종류 · 다른 부분이면 보관 결과 그대로', () => {
      const base = kept('query');
      expect(withRun(base, null, 'query')).toBe(base);
      expect(withRun(base, live({ type: 'flow', params: { pps: 1000 } }), 'query')).toBe(base);
      expect(withRun(base, live({}), 'query')).toBe(base); // 넣기를 재는 중 — 조회 대결 패널은 지난 결과
    });

    it('진행 중(running · stopping) → live — 지난 결과를 지운다 · 준비 중이면 결과 null', () => {
      const prep = withRun(
        kept('ingest'),
        live({ steps: [step('prepare', 'done'), step('clear', 'running')] }),
        'ingest',
      );
      expect(prep).toMatchObject({ kind: 'live', result: null });
      const mid = withRun(kept('ingest'), live({ result: MID }), 'ingest');
      expect(mid).toMatchObject({ kind: 'live', result: { rows: { published: 420_000 } } });
      expect(withRun(kept('ingest'), live({ status: 'stopping', result: MID }), 'ingest').kind).toBe('live');
      // 결과가 없거나 읽기 실패여도 재는 중이면 live
      expect(withRun({ kind: 'loading' }, live({}), 'ingest').kind).toBe('live');
      expect(withRun({ kind: 'failed' }, live({}), 'ingest').kind).toBe('live');
    });

    it('깜빡임 방지 — 완료됐는데 보관 결과가 아직 이 실행이 아니면 실행의 최종 결과(done) · 따라오면 평소대로', () => {
      const FINAL: R<'ingest'> = { ...INGEST, target: 1_000_000 };
      const ended = live({ status: 'completed', endedAt: '2026-10-11T10:02:00.000Z', result: FINAL });
      const before = withRun(kept('ingest'), ended, 'ingest'); // 보관 결과는 지난 실행(entry runId …001)
      expect(before).toMatchObject({ kind: 'done', result: FINAL });
      expect(finalResult(before)).toBe(FINAL);
      const caught: PartState<'ingest'> = {
        kind: 'ok',
        entry: entry(FINAL, { runId: RUN_ID }),
        result: FINAL,
        attempt: null,
      };
      expect(withRun(caught, ended, 'ingest')).toBe(caught);
      // 처음 넣기(보관 결과 없음)도 같은 규칙
      expect(withRun({ kind: 'none', attempt: null }, ended, 'ingest').kind).toBe('done');
      // 화면에 처음 들어와 보관 결과를 읽는 중이면 읽기를 기다린다(done → ok로 한 번 더 바뀌지 않게)
      expect(withRun({ kind: 'loading' }, ended, 'ingest').kind).toBe('loading');
    });

    it('중단 · 실패는 평소대로(보관 결과 + 마지막 시도 줄)', () => {
      const base = kept('ingest');
      for (const status of ['stopped', 'failed'] as const)
        expect(
          withRun(base, live({ status, endedAt: '2026-10-11T10:02:00.000Z', result: MID }), 'ingest'),
        ).toBe(base);
    });
  });

  describe('① 넣는 중', () => {
    it('큰 숫자 = 보낸 행 · 각 DB에 들어간 행(행 낱말 없이) · 크기 전이면 막대 값 없음', () => {
      const v = ingestView(MID);
      expect([v.sent, v.inCh, v.inPg]).toEqual(['42만 행', '40만', '39만']);
      expect(v.took).toBe('3.0s');
      expect(v.disk).toEqual({ ch: null, pg: null, chText: '—', pgText: '—', times: null });
      expect(v.batch.ch.p95).toBe('—');
      // 크기가 오면 그 순간 배수
      const sized = ingestView({ ...MID, bytes: { clickhouse: 1_000_000, postgres: 40_000_000 } });
      expect(sized.disk.times).toBe('40배');
    });

    it('결론 자리 — 넣는 중 · 맞춰 보는 중 · 멈추는 중(✓ · ✕ 판정 글자 없음)', () => {
      const publishing = live({ steps: [step('prepare', 'done'), step('publish', 'running')] });
      expect(ingestLiveText(publishing)).toBe('넣는 중이에요');
      expect(ingestLiveText(live({ steps: [step('drain', 'done'), step('verify', 'running')] }))).toBe(
        '다 넣었어요 — 행 수 · 크기 맞춰 보는 중이에요',
      );
      expect(ingestLiveText({ ...publishing, status: 'stopping' })).toBe('멈추는 중이에요');
      for (const r of [publishing, { ...publishing, status: 'stopping' as const }])
        expect(ingestLiveText(r)).not.toMatch(/같|달라|✓|✕/);
    });

    it('빈 축 자리의 지금 단계 — 준비 중이에요 · 지난 구간 비우는 중이에요', () => {
      expect(liveStepText(live({ steps: [step('prepare', 'running'), step('clear', 'pending')] }))).toBe(
        '준비 중이에요',
      );
      expect(liveStepText(live({ steps: [step('prepare', 'done'), step('clear', 'running')] }))).toBe(
        '지난 구간 비우는 중이에요',
      );
    });

    it('그림 — 점이 늘면 가로축이 0~마지막 점으로 늘어난다 · 점이 없으면 눈금 글자 없는 빈 축', () => {
      type Axis = { max: unknown; axisLabel: { show: boolean } };
      const o = (timeline: ReturnType<typeof ingestView>['timeline']) =>
        ingestOption({ timeline }, { font: 12, width: 400, height: 160 }) as unknown as {
          xAxis: Axis;
          yAxis: Axis;
          series: { data: unknown[] }[];
        };
      const empty = o([]);
      expect(empty.xAxis).toMatchObject({ max: 10, axisLabel: { show: false } });
      expect(empty.yAxis).toMatchObject({ max: 1, axisLabel: { show: false } });
      const two = o(ingestView(MID).timeline);
      expect(two.xAxis).toMatchObject({ max: 'dataMax', axisLabel: { show: true } });
      expect(two.yAxis.max).toBeUndefined();
      expect(two.series[0]?.data).toHaveLength(2);
    });
  });

  describe('② · ③ 하나씩 채워지는 단계', () => {
    const q1 = { ...QUERY, sizes: QUERY.sizes.slice(0, 1) };

    it('조회 대결 — 단계 9칸을 늘 그린다(끝남 · 재는 중 · 기다리는 중) · 끝난 단계만 점', () => {
      const steps = [
        step('prepare', 'done', { clickhouse: 500_000_000 }),
        step('rows-100000', 'done'),
        step('rows-1000000', 'running'),
      ];
      const v = queryView(q1, steps);
      expect(v.points.map((p) => p.phase)).toEqual(['done', 'running', ...Array(7).fill('waiting')]);
      expect(v.points.map((p) => p.mark).slice(0, 3)).toEqual(['PG 1.1배 빠름', '재는 중…', '']);
      expect(v.points[2]).toMatchObject({
        ch: null,
        pg: null,
        faster: null,
        tip: '원천 500만 행\n기다리는 중이에요',
      });
      expect(v.running).toBe('100만');
      expect(v.measured).toBe(1);
      // 첫 단계 전(결과 null) — 모두 기다림 · 지금 단계만 재는 중
      expect(
        queryView(null, [step('prepare', 'done'), step('rows-100000', 'running')]).points.map((p) => p.phase),
      ).toEqual(['running', ...Array(8).fill('waiting')]);
      // 넣은 데이터가 모자라 건너뛴 단계(결과에 실리기 전이라도 단계가 skipped면)
      expect(
        queryView(null, [step('prepare', 'done'), step('rows-100000', 'skipped')]).points[0]?.phase,
      ).toBe('skipped');
      // 완료 결과는 결과의 단계 그대로(잰 단계 · 못 잰 단계)
      expect(queryView(QUERY, null).points.map((p) => p.phase)).toEqual([
        ...Array(8).fill('done'),
        'skipped',
      ]);
    });

    it('넣은 데이터 — 결과가 있으면 결과 · 첫 단계 전이면 prepare 단계 detail', () => {
      expect(queryAvailable(q1, [])).toBe(500_000_000);
      expect(queryAvailable(null, [step('prepare', 'done', { clickhouse: 830_000 })])).toBe(830_000);
      expect(queryAvailable(null, [step('prepare', 'running')])).toBeNull();
    });

    it('데이터 정합성 — 진행 중이면 결론 자리에 지금 단계 쉬운 말(ClickHouse · PostgreSQL에서 재는 중이에요)', () => {
      const r = {
        type: 'compare' as const,
        status: 'running' as const,
        steps: [step('prepare', 'done'), step('postgres', 'running')],
      };
      expect(liveStepText(r)).toBe('PostgreSQL에서 재는 중이에요');
      expect(liveStepText({ ...r, steps: [step('prepare', 'running')] })).toBe('준비 중이에요');
    });
  });
});
