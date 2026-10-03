// 실증 요약 판독기 — 10_observability/04 §기계 판독 블록(reverse · streamSteps) · §BFF 판독 규칙 7.
// 픽스처는 test/fixtures/evidence의 가짜 기록이다(docs/measurements에 쓰지 않는다 · 값은 측정값이 아니다).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  armLabel,
  BUSINESS_TASKS,
  INCOMPLETE_TEXT,
  NO_VALUE_TEXT,
  type ReverseRow,
  readEvidence,
  SITUATIONS,
  situationLines,
  structuralVerdict,
  type TaskSummary,
  taskSummary,
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

describe('readEvidence — 규칙 4 메모리 상한(10_observability/04 §조건 칸 2026-09-27)', () => {
  const SOURCE = 'cgroup max — oltp-lab 서비스에 compose 상한 없음';
  const base = files.find((f) => f.name.startsWith('044'))?.text ?? '';
  const read = (limit: string) =>
    readEvidence([
      { name: '044-oltp-control-insert.md', text: base.replace('"memoryLimitMb": 3584,', limit) },
    ]);

  it('수 — 그대로 충족', () => {
    const r = read('"memoryLimitMb": 3584,');
    expect(r.counts.missingConditions).toBe(0);
    expect(r.reverse[0]?.run.memoryLimitMb).toBe(3584);
    expect(r.reverse[0]?.run.memoryLimitSource).toBeUndefined();
  });

  it('null + memoryLimitSource — 도구 컨테이너 경로의 상한 없음은 충족', () => {
    const r = read(`"memoryLimitMb": null, "memoryLimitSource": "${SOURCE}",`);
    expect(r.counts.missingConditions).toBe(0);
    expect(r.reverse).toHaveLength(12);
    expect(r.reverse[0]?.run).toEqual({
      commitHash: 'f1x7ure',
      memoryProfile: 'control',
      memoryLimitMb: null,
      memoryLimitSource: SOURCE,
      capacityTier: 'n/a',
    });
  });

  it('null 단독 · 빈 출처 — 4요소 누락으로 센다', () => {
    for (const limit of ['"memoryLimitMb": null,', '"memoryLimitMb": null, "memoryLimitSource": "",']) {
      const r = read(limit);
      expect(r.counts.missingConditions).toBe(1);
      expect(r.reverse).toHaveLength(0);
    }
  });
});

describe('구조 판정(3회 전부) · 판독 팔 이름', () => {
  it('structuralVerdict — 일치 · 반복마다 다름 · 3회 미만', () => {
    expect(structuralVerdict([0, 0, 0])).toEqual({ kind: 'consistent', value: 0 });
    expect(structuralVerdict([0, 1, 1])).toEqual({ kind: 'varies', min: 0, max: 1 });
    expect(structuralVerdict([8, 8])).toEqual({ kind: 'incomplete', present: 2 });
    expect(structuralVerdict([0, null, 0])).toEqual({ kind: 'incomplete', present: 2 });
  });

  it('판독 팔 이름 — 시나리오만이면 없음 · 동시 모드 · 윈도우', () => {
    expect(armLabel('inject')).toBeNull();
    expect(armLabel('pairs:upm_sync')).toBe('동시 모드 sync');
    expect(armLabel('window_100')).toBe('윈도우 100');
    expect(armLabel(null)).toBeNull();
  });
});

describe('업무 데이터 탭 — 뺀 기록 · 업무 작업 카드(판독기 상수 + 기록 수치)', () => {
  it('뺀 기록을 사유와 함께 내린다 — 카드가 "기록 폐기"와 "기록 없음"을 가른다', () => {
    expect(d.excludedRecords.map((x) => `${x.record}:${x.reason}`).sort()).toEqual([
      '041:status',
      '046:status',
      '048:conditions',
      '049:deviation',
    ]);
    expect(d.excludedRecords.every((x) => x.exps.length > 0)).toBe(true);
  });

  it('작업 5 · 구조 문장은 상수 · 수치를 박지 않는다', () => {
    expect(BUSINESS_TASKS.map((t) => t.exp)).toEqual(['EXP-42', 'EXP-43', 'EXP-41', 'EXP-44', 'EXP-40']);
    for (const t of BUSINESS_TASKS)
      expect(`${t.structural.postgresql}${t.structural.clickhouse}`).not.toMatch(/\d+(\.\d+)? ?(ms|건|B)/);
  });

  it('원자성 — 부분 반영 건수 · 3회 같으면 한 값 · 0이면 ✓', () => {
    const t = BUSINESS_TASKS.find((x) => x.id === 'atomic');
    const s = t ? taskSummary(d, t) : null;
    expect(s?.source).toBe('measured');
    expect(s?.postgresql.ok).toBe(true);
    expect(s?.clickhouse.ok).toBe(false);
    expect(s?.postgresql.text).toMatch(/^부분 반영 \d+(~\d+)?건$/);
  });

  it('분포 작업 — 가장 큰 업무 규모 · 대표 손잡이(동시성 최소)의 중앙값 범위 · ✓ ✕ 없음', () => {
    const t = BUSINESS_TASKS.find((x) => x.id === 'point');
    if (!t) throw new Error('point');
    // 픽스처 EXP-41은 read_rows뿐이라 지연 행을 같은 모양으로 만든다(값은 측정값이 아니다)
    const base = d.reverse.find((r) => r.exp === 'EXP-41' && r.store === 'postgresql');
    if (!base) throw new Error('EXP-41 행');
    const row = (
      store: 'postgresql' | 'clickhouse',
      variant: string,
      scale: number,
      concurrency: number,
      median: number,
    ) => ({
      ...base,
      store,
      variant,
      scale,
      concurrency,
      metric: 'latency_p50',
      unit: 'ms',
      values: [median, median, median],
      median,
      structural: false,
    });
    const s = taskSummary(
      {
        excludedRecords: [],
        reverse: [
          row('postgresql', 'pg', 1e6, 1, 0.1),
          row('postgresql', 'pg', 1e6, 8, 0.2),
          row('postgresql', 'pg', 1e4, 1, 9),
          row('clickhouse', 'ch_g256', 1e6, 1, 4),
          row('clickhouse', 'ch_g8192', 1e6, 1, 4.3),
        ],
      },
      t,
    );
    expect(s.postgresql).toMatchObject({ text: '지연 p50 0.10 ms', ok: null });
    expect(s.clickhouse.text).toBe('지연 p50 4.00~4.30 ms');
    expect(s.clickhouse.detail).toEqual([
      'latency_p50 · 업무 규모 10^6행 · 동시성 1',
      '그래뉼 256 4.00 ms',
      '그래뉼 8192 4.30 ms',
    ]);
  });

  it('제약 — 판독 팔 · 동시성이 다른 행은 한 합에 섞지 않는다(같은 사례를 두 번 세지 않는다)', () => {
    const t = BUSINESS_TASKS.find((x) => x.id === 'constraint');
    if (!t) throw new Error('constraint');
    const base = d.reverse[0] as ReverseRow;
    const r = (metric: string, v: number, read: string | null) => ({
      ...base,
      exp: 'EXP-43' as const,
      op: 'constraint',
      store: 'clickhouse' as const,
      variant: 'ch_mt',
      scale: 10_000,
      concurrency: 1,
      read,
      metric,
      unit: 'count',
      values: [v, v, v],
      median: v,
      structural: true,
    });
    const s = taskSummary(
      {
        excludedRecords: [],
        reverse: [
          r('accepted_count.dup_order_no', 8, 'window_100'),
          r('accepted_count.reinsert', 2, 'window_100'),
          r('accepted_count.dup_order_no', 8, 'window_1000'),
          r('accepted_count.reinsert', 1, 'window_1000'),
        ],
      },
      t,
    );
    // 팔마다 따로 — 10건 · 9건(섞으면 19건 한 묶음)
    expect(s.clickhouse.text).toBe(`${t.measure} 9~10건`);
    expect(s.clickhouse.detail).toEqual([
      'MergeTree · 윈도우 100 · 10^4행 — 10 · 10 · 10(규칙 어김 8 · 8 · 8)',
      'MergeTree · 윈도우 1000 · 10^4행 — 9 · 9 · 9(규칙 어김 7 · 7 · 7)',
    ]);
  });

  it('대표 지표(삽입 p50)가 기록에 없으면 수치를 지어내지 않고 구조 문장 상수', () => {
    const t = BUSINESS_TASKS.find((x) => x.id === 'insert');
    if (!t) throw new Error('insert');
    const s = taskSummary(d, t); // 픽스처 044는 insert_latency_p95 · active_parts만
    expect(s.source).toBe('measured');
    expect(s.postgresql).toEqual({
      text: t.structural.postgresql,
      ok: null,
      detail: [],
      range: null,
      unit: '',
      of: null,
      incomplete: false,
    });
  });

  it('valid 행이 없으면 구조 문장 상수 — 뺀 기록이 있으면 discarded · 없으면 none', () => {
    const t = BUSINESS_TASKS.find((x) => x.id === 'update');
    if (!t) throw new Error('update');
    const none = taskSummary({ reverse: [], excludedRecords: [] }, t);
    expect(none.source).toBe('none');
    expect(none.postgresql.text).toBe(t.structural.postgresql);
    const disc = taskSummary(
      { reverse: [], excludedRecords: [{ record: '047', exps: ['EXP-40'], reason: 'status' }] },
      t,
    );
    expect(disc.source).toBe('discarded');
  });
});

describe('상황 카드 — 쉬운 문장(situationLines) · 왜? 상수(SITUATIONS)', () => {
  const side = (
    text: string,
    ok: boolean | null,
    range: [number, number] | null,
    unit: string,
    of: number | null = null,
  ) => ({ text, ok, detail: [], range, unit, of, incomplete: false });
  const sum = (
    id: TaskSummary['id'],
    pg: TaskSummary['postgresql'],
    ch: TaskSummary['clickhouse'],
  ): TaskSummary => ({
    id,
    source: 'measured',
    records: ['042'],
    postgresql: pg,
    clickhouse: ch,
  });

  it('원자성 · 제약 — 건수 범위를 쉬운 문장으로 · ✓ ✕는 taskSummary 판정 그대로', () => {
    const a = situationLines(
      sum(
        'atomic',
        side('부분 반영 0건', true, [0, 0], 'count', 20),
        side('부분 반영 20건', false, [20, 20], 'count', 20),
      ),
    );
    expect(a.postgresql).toEqual({ ok: true, text: '전부 되돌림 — 깨진 데이터 0건' });
    expect(a.clickhouse).toEqual({ ok: false, text: '반만 저장 — 20번 중 20번 깨짐' });
    // 대상 수를 모르면 분모 없이 · 3회가 엇갈리면 N~M번
    const b = situationLines(
      sum('atomic', side('', true, [0, 0], 'count'), side('', false, [18, 20], 'count')),
    );
    expect(b.clickhouse.text).toBe('반만 저장 — 18~20번 깨짐');
    // 제약 CH — 받은 건수 전부(변형을 섞은 11~17)가 아니라 기본 변형의 "규칙을 어긴" 건수(받아도 되는 몫을 뺀 값)
    const c = situationLines(
      sum('constraint', side('수용 2건', true, [2, 2], 'count'), {
        ...side('수용 11~17건', false, [11, 17], 'count'),
        violated: [15, 15],
      }),
    );
    expect(c.postgresql.text).toBe('막아 냄 — 받아도 되는 2건만 받음');
    expect(c.clickhouse.text).toBe('규칙을 어긴 데이터 15건까지 받음');
    // 어긴 몫을 셀 수 없으면 받은 건수를 그대로 말하고 그 사실을 밝힌다
    const c2 = situationLines(
      sum('constraint', side('', true, [2, 2], 'count'), side('', false, [11, 17], 'count')),
    );
    expect(c2.clickhouse.text).toBe('받은 데이터 11~17건(규칙을 어긴 몫은 못 셌어요)');
  });

  it('시간 작업 — 밀리초 범위 · CH 최솟값 ÷ PG 최댓값 배수(범위면 "이상") · 빠르지 않으면 배수 없음', () => {
    const p = situationLines(
      sum('point', side('', null, [0.1, 0.1], 'ms'), side('', null, [4.16, 4.27], 'ms')),
    );
    expect(p.postgresql).toEqual({ ok: null, text: '보통 0.1밀리초' });
    // "N배 이상"은 하한 — 41.6을 반올림(42)하지 않고 내린다(41)
    expect(p.clickhouse.text).toBe('보통 4.2~4.3밀리초 — 41배 이상 느림');
    const low = situationLines(
      sum('insert', side('', null, [0.55, 1.011], 'ms'), side('', null, [2.777, 708.868], 'ms')),
    );
    expect(low.clickhouse.text).toBe('보통 2.8~709밀리초 — 2.7배 이상 느림'); // 2.777 ÷ 1.011 = 2.747 → 2.7
    const edge = situationLines(
      sum('point', side('', null, [1, 2], 'ms'), side('', null, [19.99, 20], 'ms')),
    );
    expect(edge.clickhouse.text).toBe('보통 20밀리초 — 9.9배 이상 느림'); // 19.99 ÷ 2 = 9.995 → 9.9(반올림이면 "10배")
    const same = situationLines(sum('insert', side('', null, [2, 2], 'ms'), side('', null, [8, 8], 'ms')));
    expect(same.clickhouse.text).toBe('보통 8밀리초 — 4.0배 느림');
    const none = situationLines(sum('insert', side('', null, [2, 2], 'ms'), side('', null, [1, 1], 'ms')));
    expect(none.clickhouse.text).toBe('보통 1밀리초');
  });

  it('원천이 없으면 "잰 값 없음" · 3회 미만이면 "판정할 만큼 재지 않았어요"(수치를 지어내지 않는다)', () => {
    const t = BUSINESS_TASKS.find((x) => x.id === 'insert');
    const s = t ? taskSummary(readEvidence([]), t) : null;
    if (!s) throw new Error('insert');
    expect(s.postgresql.range).toBeNull();
    expect(situationLines(s).postgresql).toEqual({ ok: null, text: NO_VALUE_TEXT });
    const inc = situationLines(
      sum('atomic', { ...side('', null, null, ''), incomplete: true }, side('', null, null, '')),
    );
    expect(inc.postgresql.text).toBe(INCOMPLETE_TEXT);
    expect(inc.clickhouse.text).toBe(NO_VALUE_TEXT);
  });

  it('원자성 대상 수 — 판독 자리 시나리오(inject)에 맞는 기록 conditions 수 · 실제 기록 042는 20', () => {
    const name = '042-oltp-control-atomic.md';
    const real = readEvidence([
      { name, text: readFileSync(path.resolve(__dirname, '../../../docs/measurements', name), 'utf8') },
    ]);
    const t = BUSINESS_TASKS.find((x) => x.id === 'atomic');
    const s = t ? taskSummary(real, t) : null;
    expect(s?.clickhouse.of).toBe(20);
    expect(s && situationLines(s).clickhouse.text).toBe('반만 저장 — 20번 중 20번 깨짐');
    expect(real.reverse.find((r) => r.read === 'probe:upm_auto')?.target).toBeNull();
  });

  it('taskSummary가 대표 수치 범위를 함께 낸다(픽스처 원자성)', () => {
    const t = BUSINESS_TASKS.find((x) => x.id === 'atomic');
    const s = t ? taskSummary(d, t) : null;
    expect(s?.postgresql.unit).toBe('count');
    expect(s?.postgresql.range?.[0]).toBe(0);
  });

  it('상황 4 — 상태 갱신 없음 · 왜? 문장에 전문 용어 · 수치 없음', () => {
    expect(SITUATIONS.map((x) => x.id)).toEqual(['atomic', 'constraint', 'point', 'insert']);
    for (const x of SITUATIONS) {
      expect(x.why).not.toMatch(/MVCC|WAL|그래뉼|B-tree|BRIN|파트 머지|EXP-|\d+(\.\d+)? ?(ms|건)/);
      expect(x.title.length).toBeLessThanOrEqual(20);
    }
  });
});
