// 모드 D(GEN-08) + 대조군 동일 행(GEN-10) — 인자 · UTC 일 분할 · 같은 시드 같은 벡터 · 두 적재 형식 · 절차 ①~⑧ · 출력 형식
// 저장소는 가짜(RowBinary · COPY BINARY 바이트를 풀어 행으로 보관)로 대신한다 — 실제 저장소 대조는 통합 확인(W3)의 몫이다.
import { QUALITY } from '@db-study/shared';
import { describe, expect, it } from 'vitest';
import {
  CH_ROW_BYTES,
  type EncodeTask,
  encodeWindow,
  PG_COPY_HEADER,
  PG_COPY_TRAILER,
  PG_EPOCH_MS,
  PG_ROW_BYTES,
} from '../src/modules/datagen/mode-d/mode-d-encode';
import type { DaySegment, ModeDRunArgs } from '../src/modules/datagen/mode-d/mode-d-options';
import {
  assertInRetention,
  DAY_MS,
  gridRange,
  minuteCover,
  parseModeDArgs,
  periodMsOf,
  splitUtcDays,
  utcDayName,
  utcDayStart,
} from '../src/modules/datagen/mode-d/mode-d-options';
import {
  type ControlStore,
  DEFAULT_TUNING,
  type EncodePool,
  ModeDRunner,
  type ModeDTags,
  modeDOutput,
  type RawStore,
  rollupChunks,
  splitChunks,
} from '../src/modules/datagen/mode-d/mode-d-runner';
import { profileFor } from '../src/modules/datagen/signal/assignment';

type Row = [ts: number, device: number, tag: number, value: number, quality: number, seq: number];

async function drain(src: AsyncIterable<Uint8Array>): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const c of src) parts.push(Buffer.from(c.buffer, c.byteOffset, c.byteLength));
  return Buffer.concat(parts);
}

function parseRowBinary(b: Buffer): Row[] {
  const out: Row[] = [];
  for (let at = 0; at < b.length; at += CH_ROW_BYTES)
    out.push([
      Number(b.readBigInt64LE(at)),
      b.readUInt32LE(at + 8),
      b.readUInt32LE(at + 12),
      b.readDoubleLE(at + 16),
      b.readUInt8(at + 24),
      Number(b.readBigUInt64LE(at + 25)),
    ]);
  return out;
}

function parseCopyBinary(b: Buffer): Row[] {
  expect(b.subarray(0, PG_COPY_HEADER.length).equals(Buffer.from(PG_COPY_HEADER))).toBe(true);
  expect(b.subarray(b.length - 2).equals(Buffer.from(PG_COPY_TRAILER))).toBe(true);
  const out: Row[] = [];
  for (let at = PG_COPY_HEADER.length; at < b.length - 2; at += PG_ROW_BYTES) {
    expect(b.readInt16BE(at)).toBe(6);
    expect([b.readInt32BE(at + 2), b.readInt32BE(at + 14), b.readInt32BE(at + 22)]).toEqual([8, 4, 4]);
    expect([b.readInt32BE(at + 30), b.readInt32BE(at + 42), b.readInt32BE(at + 48)]).toEqual([8, 2, 8]);
    out.push([
      Number(b.readBigInt64BE(at + 6)) / 1000 + PG_EPOCH_MS,
      b.readInt32BE(at + 18),
      b.readInt32BE(at + 26),
      b.readDoubleBE(at + 34),
      b.readInt16BE(at + 46),
      Number(b.readBigInt64BE(at + 52)),
    ]);
  }
  return out;
}

const inRange = (r: Row, lo: number, hi: number) => r[0] >= lo && r[0] < hi;

class FakeRaw implements RawStore {
  rows: Row[] = [];
  rollup: { lo: number; hi: number; n: number }[] = [];
  mv = true;
  live = 0;
  log: string[] = [];
  async liveRows() {
    return this.live;
  }
  async mvAttached() {
    return this.mv;
  }
  async detachMv() {
    this.log.push('detach');
    this.mv = false;
  }
  async attachMv() {
    this.log.push('attach');
    this.mv = true;
  }
  async countRaw(lo: number, hi: number) {
    return this.rows.filter((r) => inRange(r, lo, hi)).length;
  }
  async countRollup(lo: number, hi: number) {
    // 분 버킷 — 버킷 시작이 [lo, hi) 안인 조각의 행
    return this.rollup.filter((x) => x.lo >= lo && x.lo < hi).reduce((n, x) => n + x.n, 0);
  }
  async insertRaw(src: AsyncIterable<Uint8Array>) {
    this.log.push(`insert mv=${this.mv}`);
    this.rows.push(...parseRowBinary(await drain(src)));
  }
  async fillRollup(lo: number, hi: number) {
    this.log.push(`rollup mv=${this.mv}`);
    const byMin = new Map<number, number>();
    for (const r of this.rows)
      if (inRange(r, lo, hi))
        byMin.set(
          Math.floor(r[0] / 60_000) * 60_000,
          (byMin.get(Math.floor(r[0] / 60_000) * 60_000) ?? 0) + 1,
        );
    for (const [m, n] of byMin) this.rollup.push({ lo: m, hi: m + 60_000, n });
  }
}

class FakeControl implements ControlStore {
  rows: Row[] = [];
  partitions = new Set<number>();
  /** 첫 COPY에서 떨굴 행 수 — ⑧ 수리 경로 */
  loseOnFirstCopy = 0;
  copies = 0;
  cleared: string[] = [];
  async ensureDayPartitions(days: readonly number[]) {
    const created = days.filter((d) => !this.partitions.has(d));
    for (const d of created) this.partitions.add(d);
    return created;
  }
  async countControl(lo: number, hi: number) {
    return this.rows.filter((r) => inRange(r, lo, hi)).length;
  }
  async copyDay(src: AsyncIterable<Uint8Array>) {
    const rows = parseCopyBinary(await drain(src));
    this.copies += 1;
    if (this.copies === 1 && this.loseOnFirstCopy > 0) rows.splice(0, this.loseOnFirstCopy);
    for (const r of rows) expect(this.partitions.has(utcDayStart(r[0]))).toBe(true);
    this.rows.push(...rows);
  }
  async clearSegment(seg: DaySegment) {
    this.cleared.push(seg.day);
    this.rows = this.rows.filter((r) => !inRange(r, seg.fromMs, seg.toMs));
    return seg.wholeDay ? ('truncate' as const) : ('delete' as const);
  }
}

const inProc: EncodePool = { run: async (t: EncodeTask) => encodeWindow(t) };

function tagsOf(devices: number, perDevice: number, mix: 'mixed' | 'all', seed: number): ModeDTags {
  const d: number[] = [];
  const t: number[] = [];
  for (let i = 1; i <= devices; i++)
    for (let j = 1; j <= perDevice; j++) {
      d.push(i);
      t.push((i - 1) * perDevice + j);
    }
  return {
    deviceIds: Uint32Array.from(d),
    tagIds: Uint32Array.from(t),
    profiles: Uint8Array.from(t, (x) => profileFor(mix, seed, x)),
  };
}

const iso = (s: string) => Date.parse(s);

describe('인자(CLI 정본 s5-interfaces §모드 D)', () => {
  it('기본값 · on/off · --profile이 mix를 대신한다', () => {
    const a = parseModeDArgs([
      '--tier',
      'M',
      '--seed',
      '7',
      '--from',
      '2026-09-20T00:00:00+09:00',
      '--to',
      '2026-09-20T00:10:00+09:00',
    ]);
    expect(a).toMatchObject({
      action: 'fill',
      tier: 'M',
      mix: 'mixed',
      seed: 7,
      control: true,
      rollup: true,
      profile: null,
    });
    const b = parseModeDArgs([
      '--tier',
      'M',
      '--from',
      '2026-09-20T00:00:00Z',
      '--to',
      '2026-09-20T01:00:00Z',
      '--control',
      'off',
      '--rollup',
      'off',
      '--profile',
      'RANDOM_WALK',
    ]);
    expect(b).toMatchObject({
      control: false,
      rollup: false,
      mix: 'RANDOM_WALK',
      profile: 'RANDOM_WALK',
      seed: 42,
    });
    expect(parseModeDArgs(['--prune-control'])).toEqual({ action: 'prune-control', allowEmptyRaw: false });
    expect(parseModeDArgs(['--prune-control', '--allow-empty-raw'])).toEqual({
      action: 'prune-control',
      allowEmptyRaw: true,
    });
  });

  it('거부 — 시간대 없는 ISO · from ≥ to · 모르는 프로파일 · on/off 밖', () => {
    const base = ['--tier', 'M', '--from', '2026-09-20T00:00:00Z', '--to', '2026-09-20T01:00:00Z'];
    expect(() =>
      parseModeDArgs(['--tier', 'M', '--from', '2026-09-20T00:00:00', '--to', '2026-09-20T01:00:00Z']),
    ).toThrow(/시간대/);
    expect(() =>
      parseModeDArgs(['--tier', 'M', '--from', '2026-09-20T01:00:00Z', '--to', '2026-09-20T01:00:00Z']),
    ).toThrow(/--from < --to/);
    expect(() => parseModeDArgs([...base, '--profile', 'NOISE'])).toThrow(/--profile/);
    expect(() => parseModeDArgs([...base, '--control', 'yes'])).toThrow(/on · off/);
    expect(() =>
      parseModeDArgs(['--tier', 'X', '--from', '2026-09-20T00:00:00Z', '--to', '2026-09-20T01:00:00Z']),
    ).toThrow(/--tier/);
  });

  it('원시 보존 창 — from은 now − 7일 이후 · to는 now 이하', () => {
    const now = iso('2026-09-26T12:00:00Z');
    expect(() => assertInRetention(now - 7 * DAY_MS, now, now)).not.toThrow();
    expect(() => assertInRetention(now - 7 * DAY_MS - 1, now, now)).toThrow(/보존 창/);
    expect(() => assertInRetention(now - 1000, now + 1, now)).toThrow(/미래/);
  });

  it('티어 주기 · 격자 시점 — ts = k × 주기(모드 B와 같은 k)', () => {
    expect(periodMsOf('M')).toBe(1000);
    expect(periodMsOf('M+')).toBe(100);
    expect(gridRange(1500, 4000, 1000)).toEqual({ k0: 2, k1: 4 });
    expect(gridRange(2000, 4001, 1000)).toEqual({ k0: 2, k1: 5 });
  });
});

describe('UTC 일 분할(④ 일 단위 · tag_raw toYYYYMMDD(UTC) · 대조군 일 파티션과 같은 경계 · ADR-27)', () => {
  it('UTC 자정(= KST 09:00)에서 자른다 — KST 자정에서는 자르지 않는다', () => {
    const segs = splitUtcDays(iso('2026-09-20T23:30:00Z'), iso('2026-09-21T00:30:00Z'));
    expect(segs.map((s) => s.day)).toEqual(['20260920', '20260921']);
    expect(new Date((segs[0] as DaySegment).toMs).toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(splitUtcDays(iso('2026-09-20T23:30:00+09:00'), iso('2026-09-21T00:30:00+09:00'))).toHaveLength(1);
    expect(segs.every((s) => !s.wholeDay)).toBe(true);
  });

  it('여러 일 · 일 전체 표시 · 조각 합 = 구간', () => {
    const from = iso('2026-09-19T12:00:00Z');
    const to = iso('2026-09-22T00:00:00Z');
    const segs = splitUtcDays(from, to);
    expect(segs.map((s) => [s.day, s.wholeDay])).toEqual([
      ['20260919', false],
      ['20260920', true],
      ['20260921', true],
    ]);
    expect(segs.reduce((n, s) => n + (s.toMs - s.fromMs), 0)).toBe(to - from);
    expect(utcDayName(iso('2026-09-20T23:59:59.999Z'))).toBe('20260920');
    expect(utcDayName(iso('2026-09-21T00:00:00.000Z'))).toBe('20260921');
    expect(utcDayName(iso('2026-09-21T08:59:59.999+09:00'))).toBe('20260920'); // KST 09시 전은 UTC 전날
  });

  it('분 경계 넓히기 · 롤업 조각(태그 × 분 ≤ 상한)', () => {
    expect(minuteCover(61_000, 125_000)).toEqual({ fromMs: 60_000, toMs: 180_000 });
    const c = rollupChunks(iso('2026-09-20T00:00:10Z'), iso('2026-09-20T01:00:00Z'), 10_000, 200_000);
    expect(c[0]).toEqual({ fromMs: iso('2026-09-20T00:00:10Z'), toMs: iso('2026-09-20T00:20:00Z') });
    expect(c).toHaveLength(3);
  });
});

describe('벡터 · 적재 형식', () => {
  const tags = tagsOf(3, 7, 'all', 42); // 8종 전부(상태형 · DROPOUT 포함)
  const task = (
    target: 'ch' | 'pg',
    k0: number,
    steps: number,
    t = tags,
    state: Float64Array | null = null,
  ): EncodeTask => ({
    target,
    seed: 42,
    deviceIds: t.deviceIds,
    tagIds: t.tagIds,
    profiles: t.profiles,
    k0,
    steps,
    periodMs: 1000,
    state,
  });

  it('같은 시드 = 같은 바이트 · 다른 시드 = 다른 값', () => {
    const a = encodeWindow(task('ch', 1_790_000_000, 50));
    const b = encodeWindow(task('ch', 1_790_000_000, 50));
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    const other = encodeWindow({
      ...task('ch', 1_790_000_000, 50),
      seed: 43,
      profiles: Uint8Array.from(tags.tagIds, (x) => profileFor('all', 43, x)),
    });
    expect(other.checksum).not.toBe(a.checksum);
  });

  it('창 분할 · 태그 묶음 분할과 무관하게 같은 행 집합(상태 이어받기)', () => {
    const whole = encodeWindow(task('ch', 1_790_000_000, 40));
    const first = encodeWindow(task('ch', 1_790_000_000, 25));
    const second = encodeWindow(task('ch', 1_790_000_025, 15, tags, first.state));
    expect(
      Buffer.concat([Buffer.from(first.data), Buffer.from(second.data)]).equals(Buffer.from(whole.data)),
    ).toBe(true);
    const parts = splitChunks(tags, 4).map((c) => encodeWindow(task('ch', 1_790_000_000, 40, c)));
    const sum = parts.reduce((n, p) => (n + p.checksum) >>> 0, 0);
    expect(sum).toBe(whole.checksum);
    const key = (r: Row) => `${r[2]}:${r[0]}:${r[3]}`;
    expect(
      parts
        .flatMap((p) => parseRowBinary(Buffer.from(p.data)))
        .map(key)
        .sort(),
    ).toEqual(parseRowBinary(Buffer.from(whole.data)).map(key).sort());
  });

  it('RowBinary와 COPY BINARY가 같은 행을 싣는다 · quality 9 · scan_seq = k · DROPOUT은 행 생략', () => {
    const ch = encodeWindow(task('ch', 1_790_000_000, 30));
    const pg = encodeWindow(task('pg', 1_790_000_000, 30));
    expect(ch.checksum).toBe(pg.checksum);
    expect(ch.rows).toBe(pg.rows);
    expect(ch.rows + ch.dropout).toBe(tags.tagIds.length * 30);
    expect(ch.dropout).toBeGreaterThan(0);
    const a = parseRowBinary(Buffer.from(ch.data));
    const b = parseCopyBinary(
      Buffer.concat([Buffer.from(PG_COPY_HEADER), Buffer.from(pg.data), Buffer.from(PG_COPY_TRAILER)]),
    );
    expect(b).toEqual(a);
    expect(new Set(a.map((r) => r[4]))).toEqual(new Set([QUALITY.SIMULATED]));
    for (const r of a) expect(r[5]).toBe(r[0] / 1000);
  });
});

describe('절차 ①~⑧(가짜 저장소)', () => {
  const now = iso('2026-09-26T12:00:00Z');
  const args = (over: Partial<ModeDRunArgs> = {}): ModeDRunArgs => ({
    action: 'fill',
    tier: 'M',
    mix: 'mixed',
    profile: null,
    seed: 42,
    fromMs: iso('2026-09-24T23:59:10Z'),
    toMs: iso('2026-09-25T00:01:30Z'), // UTC 자정을 걸친 140초 — 분 경계가 아닌 양 끝
    control: true,
    rollup: true,
    devices: null,
    tagsPerDevice: null,
    ...over,
  });
  const tags = tagsOf(2, 5, 'mixed', 42);
  const tuning = { ...DEFAULT_TUNING, periodMs: 1000, chunks: 3, rowsPerTask: 40 }; // 작은 창 — 여러 창 · 선행 생성 경로를 지난다
  expect(now).toBeGreaterThan(0);

  it('3자 일치 · 일 2개 · DETACH → INSERT → 롤업 → ATTACH 순서 · 두 저장소 같은 행', async () => {
    const raw = new FakeRaw();
    const ctl = new FakeControl();
    const r = await new ModeDRunner(args(), tags, tuning, inProc, raw, ctl).run();
    expect(r.allMatch).toBe(true);
    expect(r.days.map((d) => d.day)).toEqual(['20260924', '20260925']);
    expect(r.days.map((d) => d.generatedRows + d.dropout)).toEqual([50 * 10, 90 * 10]);
    for (const d of r.days) {
      expect(d.chRows).toBe(d.generatedRows);
      expect(d.controlRows).toBe(d.chRows);
      expect(d.rollupCount).toBe(d.rollupRawCount);
      expect(d.repaired).toBeNull();
    }
    // 태그 10 — 롤업 조각은 epoch(UTC 일) 정렬이라 UTC 자정을 걸친 창이 조각 2로 갈린다(일 파티션과 같은 경계)
    expect(raw.log).toEqual([
      'detach',
      'insert mv=false',
      'insert mv=false',
      'rollup mv=false',
      'rollup mv=false',
      'attach',
    ]);
    const key = (x: Row) => x.join(':');
    expect(ctl.rows.map(key).sort()).toEqual(raw.rows.map(key).sort());
    expect(r.totals.partitionsCreated).toBe(2);
    expect(r.totals.chRows).toBe(raw.rows.length);
  });

  it('⑧ — 대조군 행이 모자라면 그 구간을 비우고 같은 시드로 다시 COPY → 일치', async () => {
    const raw = new FakeRaw();
    const ctl = new FakeControl();
    ctl.loseOnFirstCopy = 3;
    const r = await new ModeDRunner(args(), tags, tuning, inProc, raw, ctl).run();
    expect(r.allMatch).toBe(true);
    expect(r.days[0]?.repaired).toBe('delete');
    expect(r.days[1]?.repaired).toBeNull();
    expect(ctl.cleared).toEqual(['20260924']);
  });

  it('같은 인자 두 실행 = 같은 행 집합(시드 재현 · REQ-GEN-03)', async () => {
    const a = new FakeRaw();
    const b = new FakeRaw();
    await new ModeDRunner(args({ control: false }), tags, tuning, inProc, a, null).run();
    await new ModeDRunner(
      args({ control: false }),
      tags,
      { ...tuning, chunks: 1, rowsPerTask: 1000 },
      inProc,
      b,
      null,
    ).run();
    expect(b.rows.map((x) => x.join(':')).sort()).toEqual(a.rows.map((x) => x.join(':')).sort());
  });

  it('② 실시간 흔적 · 이미 행이 있는 구간은 DETACH 전에 거부', async () => {
    const raw = new FakeRaw();
    raw.live = 5;
    await expect(new ModeDRunner(args(), tags, tuning, inProc, raw, new FakeControl()).run()).rejects.toThrow(
      /주입 정지/,
    );
    const raw2 = new FakeRaw();
    raw2.rows.push([iso('2026-09-25T00:00:00Z'), 1, 1, 0, 9, 0]);
    await expect(
      new ModeDRunner(args(), tags, tuning, inProc, raw2, new FakeControl()).run(),
    ).rejects.toThrow(/이미 행이 있다/);
    expect(raw.log).toEqual([]);
    expect(raw2.log).toEqual([]);
  });

  it('도중 실패는 MV 분리 상태로 멈춘다(처음부터 다시)', async () => {
    const raw = new FakeRaw();
    const ctl = new FakeControl();
    ctl.copyDay = async () => {
      throw new Error('COPY 실패');
    };
    await expect(new ModeDRunner(args(), tags, tuning, inProc, raw, ctl).run()).rejects.toThrow(
      /분리 상태로 멈췄다/,
    );
    expect(raw.mv).toBe(false);
  });

  it('--control off · --rollup off — 대조군 · 롤업 칸 null', async () => {
    const raw = new FakeRaw();
    const r = await new ModeDRunner(
      args({ control: false, rollup: false }),
      tags,
      tuning,
      inProc,
      raw,
      null,
    ).run();
    expect(r.allMatch).toBe(true);
    expect(
      r.days.every((d) => d.controlRows === null && d.rollupCount === null && d.controlCopySec === null),
    ).toBe(true);
    expect(r.totals.rollupSec).toBeNull();
    expect(raw.log).toEqual(['detach', 'insert mv=false', 'insert mv=false', 'attach']);
  });

  it('출력 JSON 한 줄 — { at, mode, options, tags, days[], totals, run, switches }', async () => {
    const r = await new ModeDRunner(args(), tags, tuning, inProc, new FakeRaw(), new FakeControl()).run();
    const out = modeDOutput(new Date(now), { tier: 'M', seed: 42 }, tags.tagIds.length, r, {
      run: { commitHash: null },
      switches: { 'SW-09': 'off' },
    });
    const line = JSON.parse(JSON.stringify(out));
    expect(Object.keys(line)).toEqual(['at', 'mode', 'options', 'tags', 'days', 'totals', 'run', 'switches']);
    expect(line.mode).toBe('D');
    for (const k of [
      'day',
      'chRows',
      'controlRows',
      'rollupCount',
      'chInsertSec',
      'controlCopySec',
      'match',
      'dropout',
    ])
      expect(line.days[0]).toHaveProperty(k);
    for (const k of ['chRows', 'controlRows', 'chInsertSec', 'controlCopySec', 'rollupSec'])
      expect(line.totals).toHaveProperty(k);
  });
});
