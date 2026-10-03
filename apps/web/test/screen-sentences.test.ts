// 화면 숫자 문장 — 실제 기록 사본으로 정확한 문자열을 고정한다(리드 판정 6 · 2026-10-03).
// 픽스처 test/fixtures/real은 docs/measurements 042 · 043 · 044 · 046(업무 데이터) · 048~053(성능 비교 원천 · 단계 기록)의 사본이다 —
// 기록이 바뀌어도 이 시험은 그대로이고, 문장 규칙(반올림 · 내림 · 방향)이 바뀌면 여기서 깨진다. 값은 손으로 다시 계산한 것과 같아야 한다.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BusinessColumn } from '../components/experiments/perf/business-column';
import { SensorColumn } from '../components/experiments/perf/sensor-column';
import { RunProvider } from '../components/runs/run-context';
import { BUSINESS_TASKS, readEvidence, SITUATIONS, situationLines, taskSummary } from '../lib/evidence';
import {
  PERF_QUERIES,
  type ReadShare,
  readPerf,
  readShare,
  readWhy,
  roughText,
  rowBytes,
  type SpeedBar,
  speedBars,
  timesAtLeast,
  timesText,
} from '../lib/perf';

const DIR = path.join(__dirname, 'fixtures', 'real');
const files = readdirSync(DIR)
  .filter((n) => n.endsWith('.md'))
  .sort()
  .map((name) => ({ name, text: readFileSync(path.join(DIR, name), 'utf8') }));
const view = readPerf(files);
const evidence = readEvidence(files);
const bars = speedBars(view);
const text = (w: ReturnType<typeof readWhy>) => w?.parts.map((p) => p.text).join('') ?? null;

describe('픽스처 — 실제 기록 사본', () => {
  it('원천 053 · 단계 기록 048~052 · 업무 기록 042 · 043 · 044 · 046', () => {
    expect(view.source?.record).toBe('053');
    expect(view.stageRecords?.map((s) => [s.record, s.excluded])).toEqual([
      ['048', null],
      ['049', null],
      ['050', null],
      ['051', null],
      ['052', null],
    ]);
    expect(view.scan.at(-1)?.record).toBe('052');
    expect(view.storage.at(-1)?.record).toBe('052');
  });
});

describe('그림 1 — 10억 행에서 누가 몇 배 빠른가(speedBars)', () => {
  it('막대 끝 글자 — PG 1.7배 · CH 7.8배 · CH 101배 · CH 10배 · CH 8.8배', () => {
    const label = (b: SpeedBar) =>
      b.kind === 'win' ? `${b.winner === 'clickhouse' ? 'CH' : 'PG'} ${b.times}배` : b.kind;
    expect(bars.map(label)).toEqual(['PG 1.7배', 'CH 7.8배', 'CH 101배', 'CH 10배', 'CH 8.8배']);
    // 손 계산 — PG ÷ CH 중간값 · Q1은 PG가 빠르니 1 ÷ 0.5753 = 1.738
    expect(bars.map((b) => b.ratio?.toFixed(4))).toEqual([
      '0.5753',
      '7.8170',
      '100.5856',
      '10.1365',
      '8.8476',
    ]);
    expect(timesText(1 / 0.5753)).toBe('1.7');
  });

  it('중간값 비와 3/3 승자가 어긋나면 배수 없이 "비슷"(even)', () => {
    // Q2를 PG 승리로 바꾼다 — 중간값 비 7.8(CH가 빠름)과 어긋난다
    const flip = speedBars({
      points: view.points,
      verdicts: view.verdicts.map((x) =>
        x.query === 'Q2' && x.exponent === 9 ? { ...x, verdict: 'postgresql' as const } : x,
      ),
    });
    expect(flip.find((b) => b.query === 'Q2')).toMatchObject({
      kind: 'even',
      winner: 'postgresql',
      times: null,
    });
    // 1.0배로 반올림되는 차이도 배수를 말하지 않는다
    const at = (p: (typeof view.points)[number]) =>
      p.query === 'Q4' && p.exponent === 9 && p.cache === 'warm';
    const chMedian = view.points.find((c) => at(c) && c.store === 'clickhouse')?.median ?? 0;
    const near = speedBars({
      points: view.points.map((p) =>
        at(p) && p.store === 'postgresql' && p.index === 'I2' ? { ...p, median: chMedian * 1.04 } : p,
      ),
      verdicts: view.verdicts,
    });
    expect(near.find((b) => b.query === 'Q4')).toMatchObject({
      kind: 'even',
      winner: 'clickhouse',
      times: null,
    });
  });
});

describe('왜? 카드 ① — 그림 1과 같은 방향으로만(readWhy)', () => {
  it('질문별 문장 — Q1은 PG 승리라 "콕 집어 읽어서 PG가 빨라요" · 나머지는 전체 중 읽는 비율의 비(PG ÷ CH)', () => {
    const out = PERF_QUERIES.map((q) => {
      const w = readWhy(
        bars.find((b) => b.query === q),
        readShare(view, q),
      );
      return [q, w?.kind, text(w), w?.shares];
    });
    expect(out).toEqual([
      [
        'Q1',
        'pg',
        '이 질문은 몇 줄만 콕 집어 읽어서 PG가 빨라요(목차 · 인덱스)',
        '읽은 몫 PG 0.039% · CH 0.0011%',
      ],
      // 화면 1층은 "몫" 없이 쉬운 문장(web-ux-polish §2.2 · §7.1 R1) — 배수는 그대로 "전체 중 읽은 비율"의 비 · 몫 숫자는 툴팁(shares)
      ['Q2', 'ch', '전체 중 읽는 비율이 PG가 119배 높아요', '읽은 몫 PG 1.1% · CH 0.009%'],
      ['Q3', 'ch', '전체 중 읽는 비율이 PG가 125배 높아요', '읽은 몫 PG 전체의 1.3배 · CH 1.0%'],
      ['Q4', 'ch', '전체 중 읽는 비율이 PG가 1.2배 높아요', '읽은 몫 PG 3.6% · CH 3.1%'],
      ['Q5', 'ch', '전체 중 읽는 비율이 PG가 5.1배 높아요', '읽은 몫 PG 전부 · CH 19.5%'],
    ]);
    // 손 계산 — Q2 0.010743 ÷ 0.00009011 = 119.2 · Q5 1 ÷ 0.1951 = 5.125
    expect(readShare(view, 'Q2')?.times.toFixed(1)).toBe('119.2');
    expect(readShare(view, 'Q5')?.times.toFixed(3)).toBe('5.125');
  });

  it('모든 조합에서 그림 1과 반대로 읽히지 않는다', () => {
    const kinds: SpeedBar['kind'][] = ['win', 'even', 'undetermined', 'none'];
    const winners: SpeedBar['winner'][] = ['clickhouse', 'postgresql', null];
    const reads: ReadShare[] = [0.5, 0.99, 1, 1.04, 1.2, 119].map((times) => ({
      exponent: 9,
      record: '052',
      ch: 0.01,
      pg: 0.01 * times,
      times,
    }));
    for (const kind of kinds)
      for (const winner of winners)
        for (const read of reads) {
          const bar: SpeedBar = {
            query: 'Q2',
            exponent: 9,
            kind,
            ratio: 2,
            winner,
            times: kind === 'win' ? '2.0' : null,
          };
          const w = readWhy(bar, read);
          const t = text(w) ?? '';
          const pgWin = kind === 'win' && winner === 'postgresql';
          const chWin = kind === 'win' && winner === 'clickhouse';
          // PG가 빠르다는 문장은 그림 1이 PG 승리일 때만
          expect(t.includes('PG가 빨라요')).toBe(pgWin);
          // "읽는 비율이 PG가 N배 높다(그래서 CH가 빠르다)"는 그림 1이 CH 승리이고 PG 비율이 실제로 더 클 때만
          if (t.includes('배 높아요')) {
            expect(chWin).toBe(true);
            expect(read.times).toBeGreaterThan(1);
            expect(t).not.toContain('1.0배');
          }
          if (!pgWin && !chWin) expect(w?.kind).toBe('neutral');
          // "몫"은 툴팁에만 — 화면 문장에 쓰지 않는다
          expect(t).not.toContain('몫');
        }
    expect(readWhy(bars[1], null)).toBeNull();
  });

  it('화면 — Q1을 고르면 PG 문장 · 읽은 몫은 툴팁에', () => {
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(
          RunProvider,
          { type: 'perf' },
          createElement(SensorColumn, { view, failed: false, query: 'Q1', onQuery: () => {} }),
        ),
      ),
    );
    expect(html).toContain('data-kind="pg"');
    expect(html).toContain('이 질문은 몇 줄만 콕 집어 읽어서 ');
    expect(html).toMatch(/<b class="[^"]*">PG가 빨라요<\/b>/);
    expect(html).not.toContain('배 높아요');
    // 그림도 같은 방향 — PG가 줄 하나만 콕 집는 그림
    expect(html).toContain(
      'aria-label="PG는 필요한 줄 하나만 읽고 CH는 필요한 칸을 위에서 아래까지 읽는 그림"',
    );
    expect(html).toMatch(/title="읽은 몫 PG 0\.039% · CH 0\.0011%\n결정적 값 · 기록 052/);
  });
});

describe('왜? 카드 ② — 1행 저장 바이트(rowBytes)', () => {
  it('약 4.5바이트 · 약 108바이트 → 24배(보이는 숫자로 나눠도 맞는다)', () => {
    const b = rowBytes(view);
    expect(b).not.toBeNull();
    if (!b) return;
    expect([roughText(b.ch), roughText(b.pg), timesText(b.times)]).toEqual(['4.5', '108', '24']);
    // 손 계산 — 108.13 ÷ 4.53 = 23.88 → 24 · 보이는 값 108 ÷ 4.5 = 24.0
    expect(b.times.toFixed(2)).toBe('23.88');
    expect(Math.round(Number(roughText(b.pg)) / Number(roughText(b.ch)))).toBe(24);
  });
});

describe('업무 데이터 상황 카드 4 — situationLines', () => {
  const lines = SITUATIONS.map((s) => {
    const t = BUSINESS_TASKS.find((x) => x.id === s.id);
    if (!t) throw new Error(s.id);
    const l = situationLines(taskSummary(evidence, t));
    return [s.id, l.postgresql.ok, l.postgresql.text, l.clickhouse.ok, l.clickhouse.text];
  });

  it('카드 두 줄 — 실제 기록 그대로', () => {
    expect(lines).toEqual([
      ['atomic', true, '전부 되돌림 — 깨진 데이터 0건', false, '반만 저장 — 20번 중 20번 깨짐'],
      ['constraint', true, '막아 냄 — 받아도 되는 2건만 받음', false, '규칙을 어긴 데이터 15건까지 받음'],
      ['point', null, '보통 0.1밀리초', null, '보통 4.2~4.3밀리초 — 40배 이상 느림'],
      ['insert', null, '보통 0.55~1밀리초', null, '보통 2.8~709밀리초 — 2.7배 이상 느림'],
    ]);
  });

  it('손 계산 — 제약 MergeTree 어김 15 = (8−1) + (2−1) + 1 + 6 · 점 조회 4.16 ÷ 0.102 = 40.8 → 40 · 삽입 2.777 ÷ 1.011 = 2.75 → 2.7', () => {
    const t = BUSINESS_TASKS.find((x) => x.id === 'constraint');
    const s = t ? taskSummary(evidence, t) : null;
    expect(s?.clickhouse.violated).toEqual([15, 15]);
    expect(s?.postgresql.violated).toEqual([0, 0]);
    // 변형 차이(ReplacingMergeTree)는 툴팁에만
    expect(s?.clickhouse.detail.some((d) => d.startsWith('ReplacingMergeTree'))).toBe(true);
    expect(timesAtLeast(4.16 / 0.102)).toBe('40');
    expect(timesAtLeast(2.777 / 1.011)).toBe('2.7');
  });

  it('화면 — 상황 줄에 같은 문장(조각으로 나눠 그려도 보이는 글자에 같은 낱말 순서)', () => {
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: new QueryClient() },
        createElement(BusinessColumn, { d: evidence, failed: false }),
      ),
    );
    // 보이는 글자 — 태그를 걷고(sr-only "지킴 · 못 지킴 · 맞는 쪽"도 걷는다) 공백 하나로
    const plain = html
      .replace(/<span class="sr-only">[^<]*<\/span>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
    for (const [, , pg, , ch] of lines)
      for (const sentence of [pg, ch] as string[]) expect(plain).toContain(sentence.replace(' — ', ' '));
    // 이긴 쪽 표지 — 네 줄 모두 PostgreSQL(정확성 2 · 속도 2)
    expect(html.match(/data-winner="postgresql"/g)).toHaveLength(4);
  });
});
