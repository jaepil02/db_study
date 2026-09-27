// EXP-40 상태 전이 갱신 — IN_PROGRESS → COMPLETED 한 건씩(동시성 1) · 응답 뒤 보이기까지 폴링 · 물리 비용 · 갱신 뒤 R1 · R2(머지 전 · 후)
// 변형: pg 조건부 UPDATE · ch_alter_async(mutations_sync 0 · 판독 apply_mutations_on_fly 0 · 1 두 판독) · ch_alter_sync(mutations_sync 1)
//       ch_lwu 경량 UPDATE · ch_rmt 새 버전 삽입 + FINAL 조회(판독 final · plain — plain은 옛 버전이 머지로 사라져야 보인 것으로 센다)
// 보이기까지는 쓰기 응답 시각부터 별도 판독 커넥션이 새 값을 처음 본 시각까지다 — 상한 안에 못 보면 null(상한 안 미관측)(05_data_stores/10 §변형과 판정 지표).
//   판독기는 서로 독립으로 폴링한다(판독기마다 자기 왕복 · 자기 시각 — 앞 판독기 왕복이 뒤 판독기 가시성에 더해지지 않게 · 리드 판정 M4).
// 머지 뒤 판독은 한 호출 안에서 두 라벨 — 자연 대기 뒤 after_wait · 강제 뒤 after_force(강제 문장 · 걸린 시간을 detail에 · M1).
// 총 시간 예산(--budget-sec) — 쓰기 · 폴링이 머지 뒤 판독 몫을 남기고 멈춘다. 못 한 건 · 잘린 폴링은 값 없이 budget_exhausted로 센다(M3).
// RMT 새 버전의 나머지 컬럼은 채움 행 벡터에서 안다 — 앞 조회를 더하지 않는다(공정성 규칙 7).
// R1 · R2 판독 단계마다 측정 전 R2 예열(--read-warmup · 기본 1)을 두 저장소에 같게 돌리고 버린다(역방향 측정 조건 캐시 행).
import type { ClickHouseClient } from '@clickhouse/client';
import {
  type Ctx,
  chTable,
  logComment,
  type Measure,
  type RunResult,
  type Store,
  WO_COLUMNS,
} from './oltp-context';
import { chSettle } from './oltp-fill';
import type { RunArgs } from './oltp-options';
import { chRow, inProgressIds, SLOTS, targetIds, workOrderRow } from './oltp-rows';
import { dist, visibility } from './oltp-stats';
import {
  chNow,
  chPhys,
  chRows,
  chScalar,
  chServerTime,
  chWarm,
  eventDelta,
  KEEP_ALIVE_DETAIL,
  LWU_WRITE_SETTINGS,
  now,
  PATCH_READ_SETTINGS,
  PG_STATS_SETTLE_MS,
  pgForceFlush,
  pgPhys,
  pgPhysDelta,
  pgStmtMean,
  pgStmtStat,
  sleep,
} from './oltp-stores';

export const PG_UPDATE_SQL = 'UPDATE work_order SET status = $2 WHERE order_id = $1 AND status = $3';
export const PG_READ_STATUS_SQL = 'SELECT status FROM work_order WHERE order_id = $1';
export const PG_R1_SQL = `SELECT ${WO_COLUMNS} FROM work_order WHERE order_id = $1`;
export const PG_R2_SQL = 'SELECT status, count(*) AS n FROM work_order GROUP BY status';

type Reader = { name: string; read: (id: number) => Promise<string[]> };

/** 새 값이 보였는가 — 행이 있고 전부 COMPLETED(RMT plain 판독은 옛 버전이 남아 있으면 아직이다) */
export function isVisible(statuses: readonly string[]): boolean {
  return statuses.length > 0 && statuses.every((s) => s === 'COMPLETED');
}

export interface PollResult {
  /** 판독기별 처음 본 시각(응답 기준 ms) · 상한 안 미관측은 null */
  seen: Record<string, number | null>;
  /** 예산 마감으로 폴링을 끊은 판독기 — 값을 적지 않는다(미관측과 가른다) */
  cut: string[];
}

/**
 * 폴링 — 판독기마다 독립 고리(동시에 돈다): 자기 판독 → 보였으면 그 판독이 끝난 시각 − 응답 시각 → 아니면 간격 뒤 다시.
 * 한 판독기의 왕복이 다른 판독기의 시각에 들어가지 않는다(M4). deadline(clock 기준)을 넘기면 그 판독기를 끊는다(M3).
 */
export async function pollVisible(
  readers: readonly Reader[],
  id: number,
  ackAt: number,
  intervalMs: number,
  max: number,
  opts: { deadline?: number; clock?: () => number } = {},
): Promise<PollResult> {
  const clock = opts.clock ?? now;
  const deadline = opts.deadline ?? Number.POSITIVE_INFINITY;
  const seen: Record<string, number | null> = Object.fromEntries(readers.map((r) => [r.name, null]));
  const cut: string[] = [];
  await Promise.all(
    readers.map(async (r) => {
      for (let k = 0; k < max; k++) {
        if (clock() > deadline) {
          cut.push(r.name);
          return;
        }
        if (isVisible(await r.read(id))) {
          seen[r.name] = Math.round((clock() - ackAt) * 1000) / 1000;
          return;
        }
        if (intervalMs > 0) await sleep(intervalMs);
      }
    }),
  );
  return { seen, cut };
}

/** 판독 한 단계(R1 N건 · R2 반복 · 판독기마다) 예약 시간 — 10^6 RMT FINAL R2가 들어가는 여유 */
export const READ_PHASE_RESERVE_MS = 30_000;
/** 강제 단계(문장 · mutation 완료 대기 · 뒤 수렴 표본) 상한(초) */
export const FORCE_MAX_SEC = 60;

/** 쓰기 · 폴링 뒤에 남겨 둘 시간 — 머지 전 판독 + (자연 대기 + 판독 + 강제 + 판독) */
export function tailReserveMs(a: Pick<RunArgs, 'converge' | 'settleMaxSec'>, store: Store): number {
  if (store === 'postgresql' || a.converge === 'skip') return READ_PHASE_RESERVE_MS;
  return 3 * READ_PHASE_RESERVE_MS + (a.settleMaxSec + FORCE_MAX_SEC) * 1000;
}

function chStatusReader(
  ch: ClickHouseClient,
  table: string,
  name: string,
  settings: Record<string, unknown>,
  comment: string,
  final = false,
): Reader {
  return {
    name,
    read: async (id) =>
      (
        await chRows<{ status: string }>(
          ch,
          `SELECT status FROM ${table}${final ? ' FINAL' : ''} WHERE order_id = ${id}`,
          {},
          {
            ...settings,
            log_comment: comment,
          },
        )
      ).map((r) => r.status),
  };
}

interface Variant40 {
  table: string;
  write: (id: number) => Promise<void>;
  readers: Reader[];
  /** R1 · R2 판독 설정 묶음 — alter_async는 on-the-fly 0 · 1 둘 */
  reads: { name: string; settings: Record<string, unknown>; final: boolean }[];
  /** 문장에 명시한 설정(기록용) */
  settingsWritten: { write: Record<string, unknown>; read: Record<string, unknown> };
}

export function chVariant(ctx: Ctx, ch: ClickHouseClient, aux: ClickHouseClient): Variant40 {
  const a = ctx.args;
  const wo = chTable(a.chDb, 'work_order_control');
  const rmt = chTable(a.chDb, 'work_order_control_rmt');
  const wc = logComment(ctx, 'write');
  const pc = logComment(ctx, 'poll');
  const set = `status = 'COMPLETED' WHERE order_id = __ID__ AND status = 'IN_PROGRESS'`;
  switch (a.variant) {
    case 'ch_alter_async':
    case 'ch_alter_sync': {
      const sync = a.variant === 'ch_alter_sync' ? 1 : 0;
      return {
        table: wo,
        write: async (id) => {
          await ch.command({
            query: `ALTER TABLE ${wo} UPDATE ${set.replace('__ID__', String(id))}`,
            clickhouse_settings: { mutations_sync: String(sync), log_comment: wc },
          });
        },
        readers:
          sync === 0
            ? [
                chStatusReader(aux, wo, 'on_fly_0', { apply_mutations_on_fly: 0 }, pc),
                chStatusReader(aux, wo, 'on_fly_1', { apply_mutations_on_fly: 1 }, pc),
              ]
            : [chStatusReader(aux, wo, 'default', {}, pc)],
        reads:
          sync === 0
            ? [
                { name: 'on_fly_0', settings: { apply_mutations_on_fly: 0 }, final: false },
                { name: 'on_fly_1', settings: { apply_mutations_on_fly: 1 }, final: false },
              ]
            : [{ name: 'default', settings: {}, final: false }],
        settingsWritten: {
          write: { mutations_sync: sync },
          read: sync === 0 ? { apply_mutations_on_fly: [0, 1] } : {},
        },
      };
    }
    case 'ch_lwu':
      // 쓰기 enable_lightweight_update 1 · 판독 apply_patch_parts 1 — 문장에 명시(M2)
      return {
        table: wo,
        write: async (id) => {
          await ch.command({
            query: `UPDATE ${wo} SET ${set.replace('__ID__', String(id))}`,
            clickhouse_settings: { ...LWU_WRITE_SETTINGS, log_comment: wc },
          });
        },
        readers: [chStatusReader(aux, wo, 'default', PATCH_READ_SETTINGS, pc)],
        reads: [{ name: 'default', settings: PATCH_READ_SETTINGS, final: false }],
        settingsWritten: { write: LWU_WRITE_SETTINGS, read: PATCH_READ_SETTINGS },
      };
    case 'ch_rmt':
      return {
        table: rmt,
        write: async (id) => {
          // 행 벡터의 line_id는 채울 때 쓴 production_line 번호 — RMT는 line_id를 바꾸지 않으므로 채움 행과 같은 값을 다시 싣는다
          const row = chRow(workOrderRow(a.seed, id, a.inProgress, ctx.lineIds));
          await ch.insert({
            table: rmt,
            values: [{ ...row, status: 'COMPLETED', version: 2 }],
            format: 'JSONEachRow',
            clickhouse_settings: { log_comment: wc },
          });
        },
        readers: [chStatusReader(aux, rmt, 'final', {}, pc, true), chStatusReader(aux, rmt, 'plain', {}, pc)],
        reads: [
          { name: 'final', settings: {}, final: true },
          { name: 'plain', settings: {}, final: false },
        ],
        settingsWritten: { write: {}, read: { final: ['FINAL', 'plain'] } },
      };
    default:
      throw new Error(`exp40 변형 ${a.variant}`);
  }
}

/** R1(대상 order_id 점조회 전부) · R2(상태별 건수 반복) — ClickHouse는 log_comment로 서버 read_rows를 함께 */
async function chReads(
  ctx: Ctx,
  aux: ClickHouseClient,
  table: string,
  ids: readonly number[],
  phase: string,
  v: Variant40,
): Promise<Measure[]> {
  const out: Measure[] = [];
  for (const r of v.reads) {
    const fin = r.final ? ' FINAL' : '';
    const c1 = logComment(ctx, `${phase}:${r.name}:r1`);
    const c2 = logComment(ctx, `${phase}:${r.name}:r2`);
    const r2Sql = `SELECT status, count() AS n FROM ${table}${fin} GROUP BY status ORDER BY status`;
    const t0 = await chNow(aux);
    const lat1: number[] = [];
    for (const id of ids) {
      const s = now();
      await chRows(
        aux,
        `SELECT ${WO_COLUMNS} FROM ${table}${fin} WHERE order_id = ${id}`,
        {},
        { ...r.settings, log_comment: c1 },
      );
      lat1.push(now() - s);
    }
    // R2 예열 — 측정 전 readWarmup번 돌리고 버린다(웜 · 역방향 측정 조건 캐시 행) · PostgreSQL과 같은 자리(R1 뒤 · R2 앞)
    //   다른 log_comment라 서버 시간(c2)에 섞이지 않는다
    const cw = logComment(ctx, `${phase}:${r.name}:r2warm`);
    for (let k = 0; k < ctx.args.readWarmup; k++)
      await chRows(aux, r2Sql, {}, { ...r.settings, log_comment: cw });
    const lat2: number[] = [];
    let statusCounts: unknown = null;
    for (let k = 0; k < ctx.args.r2Repeat; k++) {
      const s = now();
      statusCounts = await chRows(aux, r2Sql, {}, { ...r.settings, log_comment: c2 });
      lat2.push(now() - s);
    }
    const s1 = await chServerTime(aux, c1, t0);
    const s2 = await chServerTime(aux, c2, t0);
    const read = `${phase}:${r.name}`;
    const d1 = dist(lat1);
    const d2 = dist(lat2);
    out.push(
      { metric: 'r1_latency_p50', unit: 'ms', value: d1.p50, read, detail: { client: d1, server: s1 } },
      { metric: 'r1_latency_p95', unit: 'ms', value: d1.p95, read },
      { metric: 'r1_read_rows', unit: 'rows', value: s1.readRowsMean, read },
      {
        metric: 'r2_latency_p50',
        unit: 'ms',
        value: d2.p50,
        read,
        detail: { client: d2, server: s2, statusCounts },
      },
      { metric: 'r2_latency_p95', unit: 'ms', value: d2.p95, read },
      { metric: 'r2_read_rows', unit: 'rows', value: s2.readRowsMean, read },
    );
  }
  return out;
}

/** 머지 뒤 판독 두 라벨 — 두 EXP(40 · 43) 공통(M1) */
export const CONVERGE_READS = ['after_wait', 'after_force'] as const;
export type ConvergeRead = (typeof CONVERGE_READS)[number];

/**
 * EXP-40 강제 수단 — 경량 UPDATE는 APPLY PATCHES(patch를 파트에 반영) · RMT는 OPTIMIZE FINAL(옛 버전 제거) ·
 * ALTER UPDATE는 강제 문장이 없다(mutation 자체가 물리 반영 — 완료를 기다린다 · null)
 */
export function forceStatement40(variant: string, table: string): string | null {
  if (variant === 'ch_lwu') return `ALTER TABLE ${table} APPLY PATCHES`;
  if (variant === 'ch_rmt') return `OPTIMIZE TABLE ${table} FINAL`;
  return null;
}

/** 이 테이블의 미완 mutation이 0이 될 때까지(상한 maxSec) */
async function chWaitMutations(
  aux: ClickHouseClient,
  db: string,
  table: string,
  maxSec: number,
): Promise<{ done: boolean; waitedSec: number }> {
  const t0 = now();
  for (;;) {
    const pend = Number(
      await chScalar(
        aux,
        'SELECT countIf(NOT is_done) AS n FROM system.mutations WHERE database = {d:String} AND table = {t:String}',
        { d: db, t: table },
      ),
    );
    const waitedSec = Math.round((now() - t0) / 100) / 10;
    if (pend === 0) return { done: true, waitedSec };
    if (waitedSec >= maxSec) return { done: false, waitedSec };
    await sleep(1000);
  }
}

/**
 * 수렴 정의(리드 판정) — 미완 mutation이 0인가 · 강제 단계는 강제 문장도 성공 완료되었는가.
 * forceOk null = 강제 문장이 없는 단계(after_wait) — 판정에 쓰지 않는다(미완 mutation 0만).
 * active patch 파트 수 · RMT 같은 키 중복은 수렴 조건이 아니라 관측값이다(APPLY PATCHES · OPTIMIZE FINAL 뒤에도 0이 아닐 수 있다).
 * 수렴은 detail.converge에만 둔다 — 관측 행(measure)에 섞지 않는다(EXP-43과 같게 · N1).
 */
export function convergedOf(o: { mutationsPending: number | undefined; forceOk: boolean | null }): boolean {
  return o.forceOk !== false && o.mutationsPending === 0;
}

/** 수렴 상태 — 수렴(convergedOf) · 관측값 activePatchParts · rmtDuplicateKeys */
async function chConvergeState(
  ctx: Ctx,
  aux: ClickHouseClient,
  v: Variant40,
  maxSec: number,
  forceOk: boolean | null = null,
): Promise<Record<string, unknown> & { converged: boolean }> {
  const s = await chSettle(aux, ctx.args.chDb, maxSec, 2);
  const [dup] =
    ctx.args.variant === 'ch_rmt'
      ? await chRows<{ d: string }>(aux, `SELECT count() - uniqExact(order_id) AS d FROM ${v.table}`)
      : [{ d: '0' }];
  const last = s.samples[s.samples.length - 1];
  return {
    settle: { converged: s.converged, waitedSec: s.waitedSec, last },
    converged: convergedOf({ mutationsPending: last?.mutationsPending, forceOk }),
    activePatchParts: last?.patchParts ?? null,
    rmtDuplicateKeys: Number(dup?.d),
  };
}

/** 강제 — 문장(있으면) 뒤 수렴 표본 · 문장 · 성공 여부 · 걸린 시간 · 수렴 상태를 기록한다 */
async function chForce(
  ctx: Ctx,
  aux: ClickHouseClient,
  v: Variant40,
  maxSec: number,
): Promise<Record<string, unknown> & { converged: boolean }> {
  const a = ctx.args;
  const forced = forceStatement40(a.variant, v.table);
  const t0 = now();
  let mutations: { done: boolean; waitedSec: number } | null = null;
  let forceOk = true;
  let forceError: string | null = null;
  if (forced)
    try {
      await aux.command({
        query: forced,
        clickhouse_settings: { mutations_sync: '1', log_comment: logComment(ctx, 'force') },
      });
    } catch (e) {
      forceOk = false;
      forceError = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    }
  else mutations = await chWaitMutations(aux, a.chDb, v.table.split('.')[1] as string, maxSec);
  const forceMs = Math.round(now() - t0);
  const state = await chConvergeState(ctx, aux, v, Math.max(6, Math.round(maxSec - forceMs / 1000)), forceOk);
  return {
    forced,
    forcedBy: forced
      ? 'statement'
      : 'ALTER UPDATE — 강제 문장 없음 · mutation 완료 대기(system.mutations is_done)',
    forceOk,
    forceError,
    forceMs,
    mutations,
    ...state,
  };
}

function pushVis(vis: Record<string, (number | null)[]>, k: string, v: number | null): void {
  const arr = vis[k] ?? [];
  arr.push(v);
  vis[k] = arr;
}

export interface WriteLoop {
  ackLat: number[];
  vis: Record<string, (number | null)[]>;
  /** 판독기별 예산 소진 — 못 한 쓰기 + 끊은 폴링 */
  budgetExhausted: Record<string, number>;
  written: number;
  skippedWrites: number;
  rowCounts: (number | null)[];
}

/** 순차 쓰기 · 응답 뒤 폴링 — deadline(now 기준)을 넘기면 남은 대상은 쓰지 않는다 */
export async function writeLoop(
  ids: readonly number[],
  write: (id: number) => Promise<number | null>,
  readers: readonly Reader[],
  a: RunArgs,
  deadline: number,
): Promise<WriteLoop> {
  const out: WriteLoop = {
    ackLat: [],
    vis: {},
    budgetExhausted: Object.fromEntries(readers.map((r) => [r.name, 0])),
    written: 0,
    skippedWrites: 0,
    rowCounts: [],
  };
  for (const id of ids) {
    if (now() > deadline) {
      out.skippedWrites++;
      for (const r of readers) out.budgetExhausted[r.name] = (out.budgetExhausted[r.name] ?? 0) + 1;
      continue;
    }
    const s = now();
    out.rowCounts.push(await write(id));
    const ack = now();
    out.written++;
    out.ackLat.push(ack - s);
    const { seen, cut } = await pollVisible(readers, id, ack, a.pollIntervalMs, a.pollMax, { deadline });
    for (const r of readers) {
      if (cut.includes(r.name)) out.budgetExhausted[r.name] = (out.budgetExhausted[r.name] ?? 0) + 1;
      else pushVis(out.vis, r.name, seen[r.name] ?? null);
    }
  }
  return out;
}

export async function runExp40(ctx: Ctx): Promise<RunResult> {
  const a = ctx.args;
  const t0Budget = now();
  const endAt = t0Budget + a.budgetSec * 1000;
  const remainingMs = () => endAt - now();
  const elapsedSec = () => Math.round((now() - t0Budget) / 100) / 10;
  const reserveMs = tailReserveMs(a, ctx.store);
  const writeDeadline = endAt - reserveMs;
  const ids = targetIds(inProgressIds(a.seed, a.scale, a.inProgress), a.seed, SLOTS.exp40, a.rep, a.n);
  const measures: Measure[] = [];
  const detail: Record<string, unknown> = { targets: { n: ids.length, first: ids.slice(0, 5) } };
  const phases: Record<string, number> = {};
  const skippedPhases: string[] = [];
  let loop: WriteLoop;
  if (ctx.store === 'postgresql') {
    const pg = ctx.pg;
    const aux = ctx.pgAux;
    if (!pg || !aux) throw new Error('PostgreSQL 접속 없음');
    const w = await pg.connect();
    const r = await aux.connect();
    try {
      const phys0 = await pgPhys(r, 'work_order');
      const st0 = await pgStmtStat(r, PG_UPDATE_SQL);
      const reader: Reader = {
        name: 'default',
        read: async (id) =>
          (await r.query<{ status: string }>(PG_READ_STATUS_SQL, [id])).rows.map((x) => x.status),
      };
      loop = await writeLoop(
        ids,
        async (id) => (await w.query(PG_UPDATE_SQL, [id, 'COMPLETED', 'IN_PROGRESS'])).rowCount ?? -1,
        [reader],
        a,
        writeDeadline,
      );
      phases.writesEnd = elapsedSec();
      await pgForceFlush(w);
      w.release();
      await sleep(PG_STATS_SETTLE_MS);
      const phys1 = await pgPhys(r, 'work_order');
      const st1 = await pgStmtStat(r, PG_UPDATE_SQL);
      const d = pgPhysDelta(phys0, phys1);
      const n = loop.written;
      detail.rowCounts = {
        one: loop.rowCounts.filter((x) => x === 1).length,
        other: loop.rowCounts.filter((x) => x !== 1).length,
      };
      detail.phys = { before: phys0, after: phys1, delta: d };
      detail.server = pgStmtMean(st0, st1);
      measures.push(
        { metric: 'wal_bytes_per_update', unit: 'B', value: n ? d.walBytes / n : null, read: null },
        { metric: 'wal_fpi_per_update', unit: 'count', value: n ? d.walFpi / n : null, read: null },
        { metric: 'tup_upd', unit: 'count', value: d.nTupUpd, read: null },
        { metric: 'hot_upd', unit: 'count', value: d.nTupHotUpd, read: null },
        // 증분(이 반복이 만든 죽은 튜플) — 절대값은 참고(detail · 앞 반복 · autovacuum 영향 · L3)
        {
          metric: 'dead_tup',
          unit: 'count',
          value: d.nDeadTup,
          read: null,
          detail: {
            delta: d.nDeadTup,
            before: phys0.nDeadTup,
            after: phys1.nDeadTup,
            autovacuumDelta: d.autovacuumCount,
          },
        },
        { metric: 'server_update_mean', unit: 'ms', value: pgStmtMean(st0, st1).meanMs, read: null },
      );
      // R1 · R2 — PostgreSQL에는 머지가 없어 갱신 직후 한 번(before_merge)만 잰다
      const lat1: number[] = [];
      for (const id of ids) {
        const s = now();
        await r.query(PG_R1_SQL, [id]);
        lat1.push(now() - s);
      }
      // R2 예열 — ClickHouse 판독과 같은 횟수 · 같은 자리(chReads · 공정성 규칙 1)
      for (let k = 0; k < a.readWarmup; k++) await r.query(PG_R2_SQL);
      const lat2: number[] = [];
      let statusCounts: unknown = null;
      for (let k = 0; k < a.r2Repeat; k++) {
        const s = now();
        statusCounts = (await r.query(PG_R2_SQL)).rows;
        lat2.push(now() - s);
      }
      phases.beforeMergeEnd = elapsedSec();
      const d1 = dist(lat1);
      const d2 = dist(lat2);
      measures.push(
        { metric: 'r1_latency_p50', unit: 'ms', value: d1.p50, read: 'before_merge:default', detail: d1 },
        { metric: 'r1_latency_p95', unit: 'ms', value: d1.p95, read: 'before_merge:default' },
        {
          metric: 'r2_latency_p50',
          unit: 'ms',
          value: d2.p50,
          read: 'before_merge:default',
          detail: { client: d2, statusCounts },
        },
        { metric: 'r2_latency_p95', unit: 'ms', value: d2.p95, read: 'before_merge:default' },
      );
    } finally {
      r.release();
    }
  } else {
    const ch = ctx.ch;
    const aux = ctx.chAux;
    if (!ch || !aux) throw new Error('ClickHouse 접속 없음');
    const v = chVariant(ctx, ch, aux);
    const tbl = v.table.split('.')[1] as string;
    detail.settingsWritten = v.settingsWritten;
    const t0 = await chNow(aux);
    const phys0 = await chPhys(aux, a.chDb, tbl, t0);
    // 쓰기 소켓 · 판독기 소켓을 측정 고리 바로 앞에서 연다 — PostgreSQL 쪽 w · r을 미리 잡는 것과 대칭(L2 · N3)
    await chWarm(ch, 1);
    await chWarm(aux, v.readers.length);
    loop = await writeLoop(
      ids,
      async (id) => {
        await v.write(id);
        return null;
      },
      v.readers,
      a,
      writeDeadline,
    );
    phases.writesEnd = elapsedSec();
    const phys1 = await chPhys(aux, a.chDb, tbl, t0);
    const server = await chServerTime(aux, logComment(ctx, 'write'), t0);
    const n = loop.written;
    const pl = (p: typeof phys1, e: string) => p.partLog[e] ?? { n: 0, bytes: 0, uncompressed: 0, rows: 0 };
    const perN = (x: number) => (n ? x / n : null);
    detail.phys = { before: phys0, afterWrites: phys1, events: eventDelta(phys0, phys1) };
    detail.server = server;
    measures.push(
      {
        metric: 'mutate_bytes_per_update',
        unit: 'B',
        value: perN(pl(phys1, 'MutatePart').bytes),
        read: 'after_writes',
      },
      {
        metric: 'merge_bytes_per_update',
        unit: 'B',
        value: perN(pl(phys1, 'MergeParts').bytes),
        read: 'after_writes',
      },
      {
        metric: 'new_part_bytes_per_update',
        unit: 'B',
        value: perN(pl(phys1, 'NewPart').bytes),
        read: 'after_writes',
      },
      { metric: 'new_parts', unit: 'count', value: pl(phys1, 'NewPart').n, read: 'after_writes' },
      { metric: 'patch_parts', unit: 'count', value: phys1.patchParts, read: 'after_writes' },
      { metric: 'active_parts', unit: 'count', value: phys1.activeParts, read: 'after_writes' },
      { metric: 'mutations_pending', unit: 'count', value: phys1.mutationsPending, read: 'after_writes' },
      { metric: 'server_update_mean', unit: 'ms', value: server.meanMs, read: null },
    );
    measures.push(...(await chReads(ctx, aux, v.table, ids, 'before_merge', v)));
    phases.beforeMergeEnd = elapsedSec();
    if (a.converge !== 'skip') {
      const converge: Record<string, unknown> = {};
      detail.converge = converge;
      // 머지 뒤 한 단계 — 물리 · R1 · R2를 같은 라벨로 · 수렴 상태는 detail.converge에만(N1)
      const phase = async (label: ConvergeRead, conv: Record<string, unknown> & { converged: boolean }) => {
        const phys = await chPhys(aux, a.chDb, tbl, t0);
        converge[label] = conv;
        (detail.phys as Record<string, unknown>)[label] = phys;
        measures.push(
          {
            metric: 'mutate_bytes_per_update',
            unit: 'B',
            value: perN(pl(phys, 'MutatePart').bytes),
            read: label,
          },
          {
            metric: 'merge_bytes_per_update',
            unit: 'B',
            value: perN(pl(phys, 'MergeParts').bytes),
            read: label,
          },
          { metric: 'patch_parts', unit: 'count', value: phys.patchParts, read: label },
          { metric: 'active_parts', unit: 'count', value: phys.activeParts, read: label },
        );
        measures.push(...(await chReads(ctx, aux, v.table, ids, label, v)));
      };
      // 자연 대기 — 뒤 단계(판독 · 강제 · 판독) 몫을 남긴 만큼만 기다린다
      const waitSec = Math.min(
        a.settleMaxSec,
        Math.floor((remainingMs() - 2 * READ_PHASE_RESERVE_MS - FORCE_MAX_SEC * 1000) / 1000),
      );
      if (waitSec >= 6) {
        await phase('after_wait', {
          waitCapSec: waitSec,
          forceOk: null,
          ...(await chConvergeState(ctx, aux, v, waitSec)),
        });
        phases.afterWaitEnd = elapsedSec();
      } else skippedPhases.push('after_wait');
      const forceSec = Math.min(FORCE_MAX_SEC, Math.floor((remainingMs() - READ_PHASE_RESERVE_MS) / 1000));
      if (forceSec >= 6) {
        await phase('after_force', await chForce(ctx, aux, v, forceSec));
        phases.afterForceEnd = elapsedSec();
      } else skippedPhases.push('after_force');
    }
  }
  const al = dist(loop.ackLat);
  measures.unshift(
    { metric: 'update_latency_p50', unit: 'ms', value: al.p50, read: null, detail: al },
    { metric: 'update_latency_p95', unit: 'ms', value: al.p95, read: null },
  );
  for (const [name, exhausted] of Object.entries(loop.budgetExhausted)) {
    const d = visibility(loop.vis[name] ?? []);
    measures.push(
      { metric: 'visible_after_ack_p50', unit: 'ms', value: d.p50, read: name, detail: d },
      { metric: 'visible_after_ack_p95', unit: 'ms', value: d.p95, read: name },
      { metric: 'visible_unobserved', unit: 'count', value: d.unobserved, read: name },
      // 예산 마감으로 재지 못한 건(쓰지 못한 대상 + 끊은 폴링) — 미관측과 다른 칸
      { metric: 'budget_exhausted', unit: 'count', value: exhausted, read: name },
    );
  }
  detail.keepAlive = KEEP_ALIVE_DETAIL;
  detail.poll = { intervalMs: a.pollIntervalMs, max: a.pollMax, readers: 'independent' };
  // 판독 표본 — R1은 대상 N건 · R2는 반복 수 · 예열은 판독 단계 · 판독기마다 측정 전 R2 횟수(측정에서 뺀다)
  detail.reads = { r1Samples: ids.length, r2Repeat: a.r2Repeat, r2Warmup: a.readWarmup };
  // 예산 검산 — 폴링 바닥(왕복 제외) = N × 상한 × 간격 · 판독기마다 독립이라 곱하지 않는다
  detail.budget = {
    budgetSec: a.budgetSec,
    tailReserveSec: reserveMs / 1000,
    writeDeadlineSec: Math.round((writeDeadline - t0Budget) / 100) / 10,
    pollFloorSec: (ids.length * a.pollMax * a.pollIntervalMs) / 1000,
    targets: ids.length,
    written: loop.written,
    skippedWrites: loop.skippedWrites,
    exhausted: loop.budgetExhausted,
    phases,
    skippedPhases,
    elapsedSec: elapsedSec(),
  };
  return { measures, detail };
}
