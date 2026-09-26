// 실증 요약 판독기 — 10_observability/04 §기계 판독 블록(reverse · streamSteps) · §BFF 판독 규칙 7.
// 픽스처는 test/fixtures/evidence의 가짜 기록이다(docs/measurements에 쓰지 않는다 · 값은 측정값이 아니다).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  median,
  PRINCIPLES,
  principleEvidence,
  quantileOf,
  readEvidence,
  reverseBars,
  type StreamRow,
  streamJudgement,
  streamSeries,
  structuralGrid,
  structuralSummary,
  structuralVerdict,
} from '../lib/evidence';
import { readMeasurements } from '../lib/measurements';

const DIR = path.join(__dirname, 'fixtures', 'evidence');
const files = readdirSync(DIR)
  .sort()
  .map((name) => ({ name, text: readFileSync(path.join(DIR, name), 'utf8') }));
const d = readEvidence(files);

describe('readEvidence — 판독 규칙', () => {
  it('규칙 1 · 2 · 3 · 4 · 5를 세고 조용히 빼지 않는다', () => {
    expect(d.counts).toEqual({
      files: 12, // notes.md는 규칙 1로 무시
      unreadable: 1, // 047 — 블록 2개
      reverse: 9, // 040 · 041 · 042 · 043 · 044 · 046 · 048 · 049 · 050
      stream: 1,
      excludedStatus: 2, // 046 폐기 · 041은 050이 정정
      excludedDeviation: 1, // 049
      missingConditions: 1, // 048
      invalidRows: 1, // 043 안의 EXP-44 행 — 기록 머리 exp에 없다
      duplicateRows: 0,
    });
    expect(d.unreadableFiles).toEqual(['047-oltp-control-insert.md']);
  });

  it('살아남은 기록의 행만 내리고 4요소를 붙인다', () => {
    expect(new Set(d.reverse.map((r) => r.record))).toEqual(new Set(['040', '042', '043', '044', '050']));
    expect(d.reverse).toHaveLength(13 + 6 + 4 + 5 + 12); // 040은 visible_unobserved(count) 1행 포함
    expect(d.stream).toHaveLength(16); // 계단 4 × 저장소 2 × 분위수 2(150,000 계단은 valid false)
    const r = d.reverse[0];
    expect(r?.run).toEqual({
      commitHash: 'f1x7ure',
      memoryProfile: 'control',
      memoryLimitMb: 3584,
      capacityTier: 'n/a',
    });
    expect(Object.keys(r?.switches ?? {})).toHaveLength(11);
  });

  it('정정 기록(supersedes)의 값을 쓴다', () => {
    const pg = d.reverse.find((r) => r.exp === 'EXP-41' && r.store === 'postgresql' && r.concurrency === 1);
    expect(pg?.record).toBe('050');
    expect(pg?.median).toBe(2);
  });

  it('EXP-45 conditions의 판정 기준을 저장소별로 붙인다', () => {
    expect(d.stream.filter((s) => s.store === 'clickhouse').every((s) => s.thresholdSec === 1)).toBe(true);
    expect(d.stream.filter((s) => s.store === 'postgresql').every((s) => s.thresholdSec === 0.5)).toBe(true);
  });

  it('역전 지점 판독(EXP-01~05)과 모수를 공유하되 서로의 행을 섞지 않는다', () => {
    const m = readMeasurements(files);
    expect(m.counts.files).toBe(d.counts.files);
    expect(m.counts.unreadable).toBe(d.counts.unreadable);
    expect(m.counts.control).toBe(1); // 051만
    expect(m.points).toHaveLength(0);
  });

  it('필드 행 형식이 어긋나면 그 행만 뺀다 · 값 배열에 수 · null 외가 섞이면 형식 위반', () => {
    const text = (files.find((f) => f.name.startsWith('044'))?.text ?? '').replace(
      '"values": [\n        1.0,',
      '"values": [\n        "1.0",',
    );
    const r = readEvidence([{ name: '044-oltp-control-insert.md', text }]);
    expect(r.counts.invalidRows).toBe(1);
    expect(r.reverse).toHaveLength(11);
  });
});

describe('요약 — 분포(중앙값)', () => {
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('EXP-40 — 업무 규모 축 · 변형 · 판독 설정별 계열 · 중앙값 없는 칸을 센다', () => {
    const lat = reverseBars(d.reverse, { exp: 'EXP-40', metric: 'update_latency_p95', scale: null });
    expect(lat.x).toEqual([10000, 100000]);
    expect(lat.series.map((s) => s.label)).toEqual([
      'PostgreSQL · pg_update · 동시성 1',
      'ClickHouse · alter_update_async · 동시성 1',
      'ClickHouse · lightweight_update · 동시성 1',
    ]);
    expect(lat.series[1]?.cells.map((c) => c?.median)).toEqual([5, 40]);
    const vis = reverseBars(d.reverse, { exp: 'EXP-40', metric: 'visible_after_ack', scale: null });
    expect(vis.series.map((s) => s.label)).toContain(
      'ClickHouse · alter_update_async · apply_mutations_on_fly=0 · 동시성 1',
    );
    expect(vis.noMedian).toBe(2); // on_fly=0 — 상한 안 미관측(두 규모)
  });

  it('EXP-41 — 동시성 축 · 업무 규모 필터', () => {
    const m = reverseBars(d.reverse, { exp: 'EXP-41', metric: 'read_rows', scale: 1_000_000 });
    expect(m.x).toEqual([1, 8]);
    expect(m.series.find((s) => s.label.includes('granularity_256'))?.cells.map((c) => c?.median)).toEqual([
      256, 256,
    ]);
    expect(reverseBars(d.reverse, { exp: 'EXP-41', metric: 'read_rows', scale: 10 }).series).toHaveLength(0);
  });

  it('EXP-44 — 요청률 축', () => {
    const m = reverseBars(d.reverse, { exp: 'EXP-44', metric: 'active_parts', scale: 10000 });
    expect(m.x).toEqual([50, 200, 500]);
    expect(m.series[0]?.cells.map((c) => c?.median)).toEqual([100, 400, 1000]);
  });

  it('구조 지표는 분포 막대에 넣지 않는다', () => {
    expect(
      reverseBars(d.reverse, { exp: 'EXP-42', metric: 'partial_apply_count', scale: null }).series,
    ).toEqual([]);
    const fin = reverseBars(d.reverse, { exp: 'EXP-43', metric: 'final_query_ms', scale: null });
    expect(fin.series).toHaveLength(2);
  });
});

describe('요약 — 구조 판정(3회 전부)', () => {
  it('structuralVerdict — 일치 · 반복마다 다름 · 3회 미만', () => {
    expect(structuralVerdict([0, 0, 0])).toEqual({ kind: 'consistent', value: 0 });
    expect(structuralVerdict([0, 1, 1])).toEqual({ kind: 'varies', min: 0, max: 1 });
    expect(structuralVerdict([8, 8])).toEqual({ kind: 'incomplete', present: 2 });
    expect(structuralVerdict([0, null, 0])).toEqual({ kind: 'incomplete', present: 2 });
  });

  it('EXP-42 그리드 — 저장소 × 사례', () => {
    const g = structuralGrid(d.reverse, 'EXP-42');
    expect(g.cases).toEqual(['partial_apply_count · atomic', 'race_violation_count · atomic']);
    expect(g.rows.map((r) => r.label)).toEqual([
      'PostgreSQL · pg_tx · 10^4행 · 동시성 2',
      'ClickHouse · lightweight_update · 10^4행 · 동시성 2',
    ]);
    expect(g.rows[1]?.cells.map((c) => c?.values)).toEqual([
      [1, 1, 1],
      [0, 1, 1],
    ]);
  });

  it('구조 판정 집계', () => {
    expect(structuralSummary(d.reverse, 'EXP-42')).toEqual({
      postgresql: { consistent: 2, varies: 0, incomplete: 0, nonZero: 0 },
      clickhouse: { consistent: 1, varies: 1, incomplete: 0, nonZero: 2 },
    });
    expect(structuralSummary(d.reverse, 'EXP-43')).toEqual({
      postgresql: { consistent: 1, varies: 0, incomplete: 0, nonZero: 1 },
      clickhouse: { consistent: 1, varies: 0, incomplete: 1, nonZero: 2 },
    });
  });
});

describe('요약 — EXP-45 계단', () => {
  it('quantileOf — 지표 이름 끝의 분위수', () => {
    expect(quantileOf('control_copy_seconds_p95')).toBe('p95');
    expect(quantileOf('insert_duration_seconds_p50')).toBe('p50');
    expect(quantileOf('p95_ms')).toBeNull();
  });

  it('분위수 하나에 두 싱크 선 — 저장소별 지표를 묶는다 · pps 오름차순', () => {
    const p95 = streamSeries(d.stream, 'p95');
    expect(p95.map((s) => s.metric)).toEqual(['control_copy_seconds_p95', 'insert_duration_seconds_p95']);
    expect(p95[0]?.steps.map((x) => x.pps)).toEqual([10000, 50000, 100000, 150000]);
    expect(p95[1]?.steps.map((x) => x.median)).toEqual([0.05, 0.1, null, null]); // 100,000 — 유효 2회 · 150,000 — 전부 무효
    const p50 = streamSeries(d.stream, 'p50');
    expect(p50.map((s) => s.metric)).toEqual(['control_copy_seconds_p50', 'insert_duration_seconds_p50']);
    expect(p50.every((s) => s.steps.length === 4)).toBe(true);
    expect(streamSeries([], 'p95').map((s) => s.metric)).toEqual([null, null]);
  });

  it('판정 점 — 기준 초과 · 관측 범위 안 없음 · 기준이 없으면 PG는 실패 계단', () => {
    expect(streamJudgement(d.stream, 'postgresql')).toEqual({
      kind: 'crossed',
      pps: 50000,
      reason: 'threshold',
      thresholdSec: 0.5,
    });
    expect(streamJudgement(d.stream, 'clickhouse')).toEqual({
      kind: 'none',
      maxPps: 100000,
      thresholdSec: 1,
    });
    const noTh: StreamRow[] = d.stream.map((s) => ({ ...s, thresholdSec: null }));
    expect(streamJudgement(noTh, 'postgresql')).toEqual({
      kind: 'crossed',
      pps: 100000,
      reason: 'failure',
      thresholdSec: null,
    });
    expect(streamJudgement([], 'postgresql')).toEqual({ kind: 'insufficient' });
  });

  it('ClickHouse 판정 점은 삽입 p95 > W만 — 실패는 보지 않고 W가 없으면 판정하지 않는다', () => {
    const chFail: StreamRow[] = d.stream.map((s) =>
      s.store === 'clickhouse' && s.pps === 10000 ? { ...s, failures: [3, 3, 3] } : s,
    );
    expect(streamJudgement(chFail, 'clickhouse')).toEqual({ kind: 'none', maxPps: 100000, thresholdSec: 1 });
    const noTh: StreamRow[] = d.stream.map((s) => ({ ...s, thresholdSec: null }));
    expect(streamJudgement(noTh, 'clickhouse')).toEqual({ kind: 'noThreshold', maxPps: 100000 });
  });

  it('반복 자리 null · valid false 행 — 판정에서 빼고 관측 범위를 넓히지 않는다', () => {
    const pg150k = d.stream.filter((s) => s.store === 'postgresql' && s.pps === 150000);
    expect(pg150k.map((s) => s.judged)).toEqual([false, false]); // 러너 valid false — 그 저장소 유효 반복 0
    const ch100k = d.stream.find((s) => s.store === 'clickhouse' && s.pps === 100000);
    expect(ch100k?.failures).toEqual([0, null, 0]); // 재기동 반복 자리만 null
    expect(ch100k?.judged).toBe(true);
    // valid false를 판정 행으로 바꿔도 median null · failures 전부 null 계단은 관측 범위가 아니다
    const allJudged: StreamRow[] = d.stream.map((s) => ({ ...s, judged: true }));
    expect(streamJudgement(allJudged, 'clickhouse')).toEqual({
      kind: 'none',
      maxPps: 100000,
      thresholdSec: 1,
    });
    // median null이어도 failures에 수가 있으면 관측이다 — 100,000 계단이 범위 끝
    const only100k = d.stream.filter((s) => s.pps >= 100000);
    expect(streamJudgement(only100k, 'clickhouse')).toEqual({
      kind: 'none',
      maxPps: 100000,
      thresholdSec: 1,
    });
    const only150k = d.stream.filter((s) => s.pps === 150000).map((s) => ({ ...s, judged: true }));
    expect(streamJudgement(only150k, 'clickhouse')).toEqual({ kind: 'insufficient' });
  });

  it('valid false · failures null 행은 판정에서 뺀다(그리기용 행에는 남는다)', () => {
    const block = (files.find((f) => f.name.startsWith('045'))?.text ?? '')
      .replace(
        /("pps": 50000,\s*"store": "postgresql",\s*"metric": "control_copy_seconds_p95",[\s\S]*?"valid": )true/,
        '$1false',
      )
      .replace(/("pps": 100000,\s*"store": "clickhouse",[\s\S]*?"failures": )\[[^\]]*\]/, '$1null');
    const r = readEvidence([{ name: '045-control-stream-ingest.md', text: block }]);
    expect(r.counts.invalidRows).toBe(0);
    expect(r.stream).toHaveLength(16);
    const pg50k = r.stream.find(
      (s) => s.store === 'postgresql' && s.pps === 50000 && s.metric.endsWith('p95'),
    );
    expect(pg50k?.judged).toBe(false);
    // 50,000 계단 p95 행이 빠져 100,000 계단의 실패가 첫 판정 점
    expect(streamJudgement(r.stream, 'postgresql')).toEqual({
      kind: 'crossed',
      pps: 100000,
      reason: 'failure',
      thresholdSec: 0.5,
    });
    const ch100k = r.stream.filter((s) => s.store === 'clickhouse' && s.pps === 100000);
    expect(ch100k.map((s) => s.judged)).toEqual([false, true]); // failures null은 p95 행 하나만
    const bad = block.replace('"valid": false', '"valid": "no"');
    expect(readEvidence([{ name: '045-control-stream-ingest.md', text: bad }]).counts.invalidRows).toBe(1);
  });
});

describe('원리 대응', () => {
  it('문서 표 7행을 옮긴 상수', () => {
    expect(PRINCIPLES).toHaveLength(7);
  });

  it('기록 값 — EXP-40 두 관측을 지표로 가른다 · 구조 · 스트리밍', () => {
    const [cost, vis, , atomic, , , stream] = PRINCIPLES;
    const c = principleEvidence(d, cost as (typeof PRINCIPLES)[number]);
    expect(c.records).toEqual(['040']);
    expect(c.lines).toEqual(['update_latency_p95 @10^5행 — PG 1.20 · CH 2.50~40.00 ms']);
    const v = principleEvidence(d, vis as (typeof PRINCIPLES)[number]);
    expect(v.lines).toEqual(['visible_after_ack @10^5행 — PG 0.30 · CH 0.50 ms']);
    // unit count 지표는 가시성 칸에서 빠지고 막대 카드에서는 그대로 고를 수 있다
    expect(reverseBars(d.reverse, { exp: 'EXP-40', metric: 'visible_unobserved', scale: null }).unit).toBe(
      'count',
    );
    const a = principleEvidence(d, atomic as (typeof PRINCIPLES)[number]);
    expect(a.lines).toEqual(['PG 구조 3회 일치 2/2칸 · 0 아닌 칸 0', 'CH 구조 3회 일치 1/2칸 · 0 아닌 칸 2']);
    const s = principleEvidence(d, stream as (typeof PRINCIPLES)[number]);
    expect(s.records).toEqual(['045']);
    expect(s.lines[0]).toBe('PG 50,000 pps에서 기준 초과');
  });

  it('EXP-40 비용 칸 — 측정 장부 지표(budget_exhausted · converged · unit bool)를 뺀다', () => {
    const row = (metric: string, unit: string, median: number) => ({
      record: '040',
      exp: 'EXP-40' as const,
      op: null,
      store: 'clickhouse' as const,
      variant: 'ch_lwu',
      scale: 100_000,
      concurrency: 1,
      rate: null,
      read: 'after_wait',
      metric,
      unit,
      values: [median, median, median],
      median,
      structural: false,
    });
    const reverse = [
      row('patch_parts', 'count', 3),
      row('budget_exhausted', 'count', 0),
      row('converged', 'bool', 1),
      row('settled_flag', 'bool', 1),
    ] as unknown as Parameters<typeof principleEvidence>[0]['reverse'];
    const [cost] = PRINCIPLES;
    const c = principleEvidence({ reverse, stream: [] }, cost as (typeof PRINCIPLES)[number]);
    expect(c.lines).toEqual(['patch_parts @10^5행 — CH 3.00 count']);
  });

  it('빈 상태 — 기록이 없으면 행이 비고 판독 불가만 센다', () => {
    const e = readEvidence([{ name: '060-oltp-control-update.md', text: '# 블록 없음' }]);
    expect(e.reverse).toEqual([]);
    expect(e.stream).toEqual([]);
    expect(e.counts.unreadable).toBe(1);
    expect(principleEvidence(e, PRINCIPLES[6] as (typeof PRINCIPLES)[number])).toEqual({
      records: [],
      lines: [],
    });
  });
});
