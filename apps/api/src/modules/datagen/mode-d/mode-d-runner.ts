// 모드 D 백필 + 대조군 동일 행 — 절차 정본 docs/06_pipeline/10_datagen_inject.md §모드 D 백필과 대조군 동일 행 ①~⑧
// ① 조건 확정(인자) ② 주입 정지 확인 ③ DETACH mv_tag_1m ④ KST 일 단위(벡터 → tag_raw INSERT → 대조군 COPY) ⑤ tag_1m INSERT SELECT
// ⑥ ATTACH ⑦ 일마다 count(tag_raw) = count(대조군) = countMerge(tag_1m) ⑧ 불일치 일은 대조군 그 구간을 비우고 같은 시드로 다시 COPY → ⑦
// 한 벡터를 두 저장소에 쓴다 — 하루치가 메모리에 들어가지 않아 일마다 같은 인자로 두 번 생성하고(형식만 다르다) 지문으로 같은 벡터임을 확인한다.
// 도중 실패는 MV 분리 상태로 남기고 멈춘다 — 멱등 토큰이 없어 부분 재실행은 중복을 만든다(REQ-GEN-10 · 처음부터 다시).

import {
  type EncodeResult,
  type EncodeTarget,
  type EncodeTask,
  initialStates,
  PG_COPY_HEADER,
  PG_COPY_TRAILER,
} from './mode-d-encode';
import { type DaySegment, gridRange, type ModeDRunArgs, minuteCover, splitKstDays } from './mode-d-options';

export interface EncodePool {
  run(task: EncodeTask): Promise<EncodeResult>;
}

/** ClickHouse 쪽(tag_raw · tag_1m · mv_tag_1m) */
export interface RawStore {
  /** ② 실시간 적재 흔적 — ts · ingested_at이 둘 다 최근 30초 안인 행 수 */
  liveRows(): Promise<number>;
  mvAttached(): Promise<boolean>;
  detachMv(): Promise<void>;
  attachMv(): Promise<void>;
  countRaw(fromMs: number, toMs: number): Promise<number>;
  countRollup(fromMs: number, toMs: number): Promise<number>;
  insertRaw(rowBinary: AsyncIterable<Uint8Array>): Promise<void>;
  fillRollup(fromMs: number, toMs: number): Promise<void>;
}

/** PostgreSQL 대조군 쪽(plc_tag_raw_control) */
export interface ControlStore {
  /** 없는 KST 일 파티션을 만든다 — 만든 일(dayStartMs) 목록 */
  ensureDayPartitions(dayStarts: readonly number[]): Promise<number[]>;
  countControl(fromMs: number, toMs: number): Promise<number>;
  /** 전용 커넥션 · 트랜잭션 1(BEGIN · COPY BINARY · COMMIT) · synchronous_commit off */
  copyDay(copyBinary: AsyncIterable<Uint8Array>): Promise<void>;
  /** ⑧ 그 구간 비우기 — 일 전체면 파티션 TRUNCATE · 부분이면 구간 DELETE */
  clearSegment(seg: DaySegment): Promise<'truncate' | 'delete'>;
}

export interface ModeDTags {
  deviceIds: Uint32Array;
  tagIds: Uint32Array;
  profiles: Uint8Array;
}

export interface ModeDTuning {
  periodMs: number;
  /** 태그 묶음 수 — 워커보다 넉넉해야 풀이 쉬지 않는다 */
  chunks: number;
  /** 작업 하나의 목표 행 수 — 창 시점 수 = 이 값 ÷ 묶음 태그 */
  rowsPerTask: number;
  /** 미리 넣어 두는 창 수 — 쓰는 동안 다음 창을 만든다 */
  aheadWindows: number;
  /** 롤업 INSERT SELECT 한 번의 그룹(태그 × 분) 상한 — tdigest 상태 메모리를 묶는다 */
  rollupGroupsPerChunk: number;
}

export const DEFAULT_TUNING: Omit<ModeDTuning, 'periodMs' | 'chunks'> = {
  rowsPerTask: 262_144,
  aheadWindows: 2,
  rollupGroupsPerChunk: 200_000,
};

export interface ModeDDay {
  day: string;
  from: string;
  to: string;
  chRows: number;
  controlRows: number | null;
  /** countMerge(tag_1m) — 분 경계로 넓힌 구간(rollupRange) */
  rollupCount: number | null;
  /** 같은 넓힌 구간의 count(tag_raw) — 구간이 분 경계면 chRows와 같다 */
  rollupRawCount: number | null;
  chInsertSec: number;
  controlCopySec: number | null;
  match: boolean;
  generatedRows: number;
  dropout: number;
  /** ⑧ 수리 — null이면 수리 없음 */
  repaired: 'truncate' | 'delete' | null;
}

export interface ModeDSummary {
  days: ModeDDay[];
  totals: {
    chRows: number;
    controlRows: number | null;
    chInsertSec: number;
    controlCopySec: number | null;
    rollupSec: number | null;
    generatedRows: number;
    dropout: number;
    /** 워커가 생성 · 인코딩에 쓴 시간 합(두 형식 패스 · 수리 포함) — 생성기 포화 판정(REQ-GEN-13) */
    genBusySec: number;
    partitionsCreated: number;
    mvWasAttached: boolean;
  };
  allMatch: boolean;
}

interface Written {
  days: { seg: DaySegment; ch: PassAcc; chMs: number; pgMs: number | null }[];
  rollupMs: number | null;
}

interface PassAcc {
  rows: number;
  dropout: number;
  checksum: number;
  busyMs: number;
}

export interface RunnerClockD {
  monoMs(): number;
}
const mono: RunnerClockD = { monoMs: () => performance.now() };

const sec = (ms: number) => Math.round(ms) / 1000;

/** 태그 묶음 — 연속 구간으로 자른다(묶음 경계는 값에 영향이 없다 · 상태는 태그별) */
export function splitChunks(tags: ModeDTags, chunks: number): ModeDTags[] {
  const n = tags.tagIds.length;
  const c = Math.max(1, Math.min(chunks, n));
  const per = Math.ceil(n / c);
  const out: ModeDTags[] = [];
  for (let a = 0; a < n; a += per) {
    const b = Math.min(n, a + per);
    out.push({
      deviceIds: tags.deviceIds.slice(a, b),
      tagIds: tags.tagIds.slice(a, b),
      profiles: tags.profiles.slice(a, b),
    });
  }
  return out;
}

/** 롤업 채우기 조각 — 분 경계 · 조각당 (태그 × 분) ≤ 상한 */
export function rollupChunks(fromMs: number, toMs: number, tagCount: number, groupsPerChunk: number) {
  const minutes = Math.min(1440, Math.max(1, Math.floor(groupsPerChunk / Math.max(1, tagCount))));
  const span = minutes * 60_000;
  const out: { fromMs: number; toMs: number }[] = [];
  for (let a = fromMs; a < toMs; ) {
    const b = Math.min(toMs, (Math.floor(a / span) + 1) * span);
    out.push({ fromMs: a, toMs: b });
    a = b;
  }
  return out;
}

export class ModeDRunner {
  private readonly chunkTags: ModeDTags[];
  private genBusyMs = 0;

  constructor(
    private readonly args: ModeDRunArgs,
    private readonly tags: ModeDTags,
    private readonly tuning: ModeDTuning,
    private readonly pool: EncodePool,
    private readonly raw: RawStore,
    private readonly control: ControlStore | null,
    private readonly clock: RunnerClockD = mono,
  ) {
    if (args.control && !control) throw new Error('--control on인데 대조군 저장소가 없다');
    this.chunkTags = splitChunks(tags, tuning.chunks);
  }

  /** 한 구간 · 한 형식의 적재 바이트 흐름 — 묶음별 상태 사슬 · 창 단위 선행 생성 */
  async *encodeSegment(seg: DaySegment, target: EncodeTarget, acc: PassAcc): AsyncGenerator<Uint8Array> {
    if (target === 'pg') yield PG_COPY_HEADER;
    const { k0, k1 } = gridRange(seg.fromMs, seg.toMs, this.tuning.periodMs);
    const total = k1 - k0;
    const maxChunkTags = Math.max(...this.chunkTags.map((c) => c.tagIds.length));
    const windowSteps = Math.max(1, Math.floor(this.tuning.rowsPerTask / maxChunkTags));
    const windows = Math.ceil(total / windowSteps);
    // 구간 첫 시점의 상태 — 일(구간)마다 새로 시작한다: 같은 구간 인자면 같은 행(⑧ 재생성 · 두 형식 패스)
    const last: Promise<Float64Array | null>[] = this.chunkTags.map(() => Promise.resolve(null));
    const submit = (w: number): Promise<EncodeResult>[] =>
      this.chunkTags.map((c, i) => {
        const p = (last[i] as Promise<Float64Array | null>).then((state) =>
          this.pool.run({
            target,
            seed: this.args.seed,
            deviceIds: c.deviceIds,
            tagIds: c.tagIds,
            profiles: c.profiles,
            k0: k0 + w * windowSteps,
            steps: Math.min(windowSteps, total - w * windowSteps),
            periodMs: this.tuning.periodMs,
            state: state ?? initialStates(c.profiles, this.args.seed, c.tagIds),
          }),
        );
        const next = p.then((r) => r.state);
        next.catch(() => undefined); // 실패는 아래 Promise.all이 드러낸다 — 사슬 뒤쪽의 거절을 처리된 것으로 둔다
        p.catch(() => undefined);
        last[i] = next;
        return p;
      });
    const queue: Promise<EncodeResult>[][] = [];
    for (let w = 0; w < Math.min(windows, this.tuning.aheadWindows); w++) queue.push(submit(w));
    for (let w = 0; w < windows; w++) {
      const results = await Promise.all(queue.shift() as Promise<EncodeResult>[]);
      if (w + this.tuning.aheadWindows < windows) queue.push(submit(w + this.tuning.aheadWindows));
      for (const r of results) {
        acc.rows += r.rows;
        acc.dropout += r.dropout;
        acc.checksum = (acc.checksum + r.checksum) >>> 0;
        acc.busyMs += r.busyMs ?? 0;
        if (r.data.byteLength > 0) yield r.data;
      }
    }
    if (target === 'pg') yield PG_COPY_TRAILER;
  }

  private async pass(seg: DaySegment, target: EncodeTarget): Promise<{ acc: PassAcc; ms: number }> {
    const acc: PassAcc = { rows: 0, dropout: 0, checksum: 0, busyMs: 0 };
    const t0 = this.clock.monoMs();
    if (target === 'ch') await this.raw.insertRaw(this.encodeSegment(seg, 'ch', acc));
    else await (this.control as ControlStore).copyDay(this.encodeSegment(seg, 'pg', acc));
    this.genBusyMs += acc.busyMs;
    return { acc, ms: this.clock.monoMs() - t0 };
  }

  async run(): Promise<ModeDSummary> {
    const a = this.args;
    const segs = splitKstDays(a.fromMs, a.toMs);
    // ② 주입 정지 확인 — 분리 중 들어온 실시간 행은 롤업되지 않는다(04_clickhouse_rollup §백필 절차 ①)
    const live = await this.raw.liveRows();
    if (live > 0)
      throw new Error(
        `② 주입 정지 확인 실패 — 최근 30초 안에 적재된 실시간 행 ${live} · 모드 A~C · 정상 수집을 멈추고 다시`,
      );
    // 빈 구간 확인 — 이미 행이 있는 구간에 다시 넣으면 중복이다(백필에는 멱등 토큰이 없다)
    for (const s of segs) {
      const r = await this.raw.countRaw(s.fromMs, s.toMs);
      const c = a.control ? await (this.control as ControlStore).countControl(s.fromMs, s.toMs) : 0;
      if (r > 0 || c > 0)
        throw new Error(
          `구간 ${s.day} [${new Date(s.fromMs).toISOString()}, ${new Date(s.toMs).toISOString()})에 이미 행이 있다(tag_raw ${r} · 대조군 ${c}) — 부분 재실행은 중복을 만든다 · 스냅샷 복원 또는 그 구간 정리 뒤 처음부터`,
        );
    }
    const created = a.control
      ? await (this.control as ControlStore).ensureDayPartitions(segs.map((s) => s.dayStartMs))
      : [];
    // ③ DETACH — 앞 실행이 실패로 분리된 채 남았으면 그대로 이어 간다
    const mvWasAttached = await this.raw.mvAttached();
    if (mvWasAttached) await this.raw.detachMv();
    const written = await this.fillDetached(segs).catch((e: unknown) => {
      const m = e instanceof Error ? e.message : String(e);
      throw new Error(
        `${m} — mv_tag_1m 분리 상태로 멈췄다(REQ-GEN-10): 이미 쓴 구간을 정리(또는 스냅샷 복원)한 뒤 처음부터 다시`,
      );
    });
    // ⑥ ATTACH — 정상 연쇄 복귀
    await this.raw.attachMv();

    // ⑦ 대조 · ⑧ 수리(대조군만 — 1회)
    return this.verify(written, created.length, mvWasAttached);
  }

  /** ④ 일 단위(벡터 → tag_raw INSERT → 대조군 COPY) · ⑤ 롤업 채우기 — MV 분리 상태에서만 부른다 */
  private async fillDetached(segs: DaySegment[]): Promise<Written> {
    const a = this.args;
    const written: Written['days'] = [];
    for (const s of segs) {
      const ch = await this.pass(s, 'ch');
      let pgMs: number | null = null;
      if (a.control) {
        const pg = await this.pass(s, 'pg');
        if (pg.acc.rows !== ch.acc.rows || pg.acc.checksum !== ch.acc.checksum)
          throw new Error(
            `${s.day} 두 형식 패스의 벡터가 다르다(행 ${ch.acc.rows} · ${pg.acc.rows} · 지문 ${ch.acc.checksum} · ${pg.acc.checksum}) — 생성기 결정성 결함`,
          );
        pgMs = pg.ms;
      }
      written.push({ seg: s, ch: ch.acc, chMs: ch.ms, pgMs });
    }
    // ⑤ 롤업 채우기 — 백필 구간만 · 상위 MV 연쇄가 tag_1h · tag_1d를 채운다
    let rollupMs: number | null = null;
    if (a.rollup) {
      const t0 = this.clock.monoMs();
      for (const c of rollupChunks(
        a.fromMs,
        a.toMs,
        this.tags.tagIds.length,
        this.tuning.rollupGroupsPerChunk,
      ))
        await this.raw.fillRollup(c.fromMs, c.toMs);
      rollupMs = this.clock.monoMs() - t0;
    }
    return { days: written, rollupMs };
  }

  private async verify(
    w0: Written,
    partitionsCreated: number,
    mvWasAttached: boolean,
  ): Promise<ModeDSummary> {
    const a = this.args;
    const { days: written, rollupMs } = w0;
    const days: ModeDDay[] = [];
    for (const w of written) {
      const s = w.seg;
      const chRows = await this.raw.countRaw(s.fromMs, s.toMs);
      let controlRows = a.control
        ? await (this.control as ControlStore).countControl(s.fromMs, s.toMs)
        : null;
      let repaired: ModeDDay['repaired'] = null;
      if (controlRows !== null && controlRows !== chRows) {
        repaired = await (this.control as ControlStore).clearSegment(s);
        const again = await this.pass(s, 'pg');
        if (again.acc.checksum !== w.ch.checksum || again.acc.rows !== w.ch.rows)
          throw new Error(`${s.day} ⑧ 재생성 벡터가 첫 생성과 다르다 — 생성기 결정성 결함`);
        controlRows = await (this.control as ControlStore).countControl(s.fromMs, s.toMs);
      }
      let rollupCount: number | null = null;
      let rollupRawCount: number | null = null;
      if (a.rollup) {
        const cover = minuteCover(s.fromMs, s.toMs);
        rollupCount = await this.raw.countRollup(cover.fromMs, cover.toMs);
        rollupRawCount =
          cover.fromMs === s.fromMs && cover.toMs === s.toMs
            ? chRows
            : await this.raw.countRaw(cover.fromMs, cover.toMs);
      }
      const match =
        chRows === w.ch.rows &&
        (controlRows === null || controlRows === chRows) &&
        (rollupCount === null || rollupCount === rollupRawCount);
      days.push({
        day: s.day,
        from: new Date(s.fromMs).toISOString(),
        to: new Date(s.toMs).toISOString(),
        chRows,
        controlRows,
        rollupCount,
        rollupRawCount,
        chInsertSec: sec(w.chMs),
        controlCopySec: w.pgMs === null ? null : sec(w.pgMs),
        match,
        generatedRows: w.ch.rows,
        dropout: w.ch.dropout,
        repaired,
      });
    }
    const sum = (f: (d: ModeDDay) => number | null) => days.reduce((n, d) => n + (f(d) ?? 0), 0);
    return {
      days,
      totals: {
        chRows: sum((d) => d.chRows),
        controlRows: a.control ? sum((d) => d.controlRows) : null,
        chInsertSec: sec(written.reduce((n, w) => n + w.chMs, 0)),
        controlCopySec: a.control ? sec(written.reduce((n, w) => n + (w.pgMs ?? 0), 0)) : null,
        rollupSec: rollupMs === null ? null : sec(rollupMs),
        generatedRows: sum((d) => d.generatedRows),
        dropout: sum((d) => d.dropout),
        genBusySec: sec(this.genBusyMs),
        partitionsCreated,
        mvWasAttached,
      },
      allMatch: days.every((d) => d.match),
    };
  }
}

/** 출력 JSON 한 줄(인터페이스 정본 .omc/s5-interfaces.md §모드 D) — { at, mode, options, tags, days, totals, run, switches } */
export function modeDOutput(
  at: Date,
  options: Record<string, unknown>,
  tags: number,
  r: ModeDSummary,
  info: { run: unknown; switches: unknown },
) {
  return { at: at.toISOString(), mode: 'D' as const, options, tags, days: r.days, totals: r.totals, ...info };
}
