// EXP-43 무결성 제약 — 같은 입력의 수용 건수(구조 · 3회 전부) + RMT 머지 전 · 후 중복 수 · FINAL 대 비 FINAL 비용(분포)
// 입력 — ⓐ 같은 order_no 동시 삽입 K ⓑ 없는 line_id ⓒ CHECK 위반 3종(INSERT 경로 · UPDATE 경로) ⓓ 같은 주문 재삽입(재시도 모양)
// ClickHouse 새 행의 order_id는 실행기가 발급한다(시퀀스 없음) — ⓐ의 K행은 서로 다른 order_id · 같은 order_no(앱이 번호를 따로 받는 모양),
//   ⓓ는 같은 order_id · 같은 order_no 두 번. RMT는 정렬 키(order_id) 단위로만 합치므로 ⓐ는 머지 뒤에도 남는다 — 그것이 관측이다.
// ⓓ 재삽입의 모양 — PostgreSQL은 order_id가 IDENTITY라 보내지 않는다: 같은 order_no 재전송(행마다 새 order_id를 받는다) ·
//   ClickHouse는 같은 order_id · 같은 order_no 재전송. 입력 모양이 다르다는 사실을 detail.reinsertShape에 남긴다(L5 · 정본 문구는 W6).
// ⓐ 동시 K는 두 저장소 커넥션 K개(connPlan · 미리 연결) — 풀 대기가 동시 삽입을 흩지 않게(L4).
// UPDATE 경로 — PostgreSQL UPDATE · ClickHouse work_order_control 경량 UPDATE(enable_lightweight_update 1 명시)와 ALTER UPDATE(mutations_sync 1)만 ·
//   RMT는 INSERT 경로만(W1 재검수). 오류 없이 위반 값이 되읽히면(apply_patch_parts 1 명시) 수용으로 센다.
// 머지 뒤 중복 수 — 한 호출 안에서 자연 대기 뒤 after_wait · OPTIMIZE FINAL 뒤 after_force(두 엔진 같은 강제 · EXP-40과 같은 라벨 · M1).
// ch_mt_dedup — ⓓ만: 실행 범위에서 work_order_control에 non_replicated_deduplication_window N을 켜고 insert_deduplication_token 유 · 무로
//   같은 행을 두 번 보낸 뒤 설정을 되돌린다(RESET SETTING — 기본 0 · 스키마 정본과 같은 메타데이터). 비복제 MergeTree는 윈도우 > 0이면
//   토큰 없이도 블록 내용 해시로 같은 블록을 버린다 — 토큰 유무 · DuplicatedInsertedBlocks 증분을 원시에 남긴다(W1 검수 판정).
import type { ClickHouseClient } from '@clickhouse/client';
import type { Pool } from 'pg';
import { type Ctx, chTable, logComment, type Measure, type RunResult } from './oltp-context';
import { chSettle } from './oltp-fill';
import { chRow, inProgressIds, SLOTS, targetIds, type WorkOrderRow, workOrderRow } from './oltp-rows';
import { acceptedCounts, dist } from './oltp-stats';
import {
  chNow,
  chRows,
  chScalar,
  chServerTime,
  chWarm,
  LWU_WRITE_SETTINGS,
  now,
  PATCH_READ_SETTINGS,
  pgWarmPool,
} from './oltp-stores';
import { type ConvergeRead, convergedOf } from './oltp-update';

export const PG_WO_INSERT_SQL = `INSERT INTO work_order (line_id, order_no, product_code, target_qty, planned_start, planned_end, status)
VALUES ($1, $2, $3, $4, $5, $6, $7)`;
/** 없는 line_id — production_line에 없는 번호(UInt32 · integer 둘 다 담긴다) */
export const MISSING_LINE_ID = 2_147_483_000;
/** ClickHouse 새 주문 order_id 대역 — 채움(≤ 10^6)과 겹치지 않는다 */
export const NEW_ORDER_BASE_43 = 10_000_000;

export type InsertCase =
  | 'dup_order_no'
  | 'missing_line'
  | 'check_target_qty'
  | 'check_planned'
  | 'check_status'
  | 'reinsert';
export const UPDATE_KINDS = ['target_qty', 'planned', 'status'] as const;

/** 경우별 입력 행 — 기준은 채움 벡터의 한 행 모양(값 범위 동일) · order_no는 반복마다 새로 */
export function caseRow(base: WorkOrderRow, c: InsertCase, orderNo: string): WorkOrderRow {
  const r = { ...base, orderNo, status: 'PLANNED' as const };
  switch (c) {
    case 'missing_line':
      return { ...r, lineId: MISSING_LINE_ID };
    case 'check_target_qty':
      return { ...r, targetQty: 0 };
    case 'check_planned':
      return { ...r, plannedEndMs: r.plannedStartMs };
    case 'check_status':
      return { ...r, status: 'BOGUS' as never };
    default:
      return r;
  }
}

const pgParams = (r: WorkOrderRow) => [
  r.lineId,
  r.orderNo,
  r.productCode,
  r.targetQty,
  new Date(r.plannedStartMs).toISOString(),
  new Date(r.plannedEndMs).toISOString(),
  r.status,
];

async function attempt(fn: () => Promise<unknown>): Promise<{ ok: boolean; error?: string }> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) };
  }
}

const PG_UPDATE_CASES: Record<(typeof UPDATE_KINDS)[number], string> = {
  target_qty: 'UPDATE work_order SET target_qty = 0 WHERE order_id = $1',
  planned: 'UPDATE work_order SET planned_end = planned_start WHERE order_id = $1',
  status: "UPDATE work_order SET status = 'BOGUS' WHERE order_id = $1",
};
const CH_SET: Record<(typeof UPDATE_KINDS)[number], string> = {
  target_qty: 'target_qty = 0',
  planned: 'planned_end = planned_start',
  status: "status = 'BOGUS'",
};

/** UPDATE 경로 문장 설정 — 경량 UPDATE는 enable_lightweight_update 1 · ALTER UPDATE는 mutations_sync 1(M2) */
export function chUpdatePathSettings(
  path: 'lwu' | 'alter',
  comment: string,
): Record<string, string | number> {
  return path === 'lwu'
    ? { ...LWU_WRITE_SETTINGS, log_comment: comment }
    : { mutations_sync: 1, log_comment: comment };
}

/** EXP-43 강제 수단 — MergeTree · RMT 모두 OPTIMIZE FINAL(MergeTree는 머지가 order_no 중복을 합치지 않음을 · RMT는 ⓓ를 합침을 본다) */
export function forceStatement43(table: string): string {
  return `OPTIMIZE TABLE ${table} FINAL`;
}

/** ⓓ 입력 모양(L5) — 두 저장소가 다르다는 기록 */
export const REINSERT_SHAPE = {
  postgresql: '같은 order_no 재전송 — order_id는 IDENTITY라 보내지 않는다(행마다 새 order_id)',
  clickhouse: '같은 order_id · 같은 order_no 재전송',
} as const;

/** 테이블 설정 문자열의 중복 제거 윈도우 — 없으면 기본 0 */
export function dedupWindowOf(engineFull: string): number {
  const m = /non_replicated_deduplication_window = (\d+)/.exec(engineFull);
  return m ? Number(m[1]) : 0;
}

async function runDedup(ctx: Ctx, no: (c: string) => string, base: WorkOrderRow): Promise<RunResult> {
  const a = ctx.args;
  const ch = ctx.ch as ClickHouseClient;
  const aux = ctx.chAux as ClickHouseClient;
  const table = chTable(a.chDb, 'work_order_control');
  const wc = logComment(ctx, 'write');
  const windowNow = async () =>
    dedupWindowOf(
      await chScalar(
        aux,
        "SELECT engine_full AS e FROM system.tables WHERE database = {d:String} AND name = 'work_order_control'",
        {
          d: a.chDb,
        },
      ),
    );
  const before = await windowNow();
  if (before !== 0)
    throw new Error(
      `${table} 중복 제거 윈도우가 이미 ${before}다 — 앞 실행이 되돌리지 못했다(ALTER TABLE … RESET SETTING 뒤 다시)`,
    );
  const ev = async () =>
    Number(
      await chScalar(
        aux,
        "SELECT sum(value) AS v FROM system.events WHERE event = 'DuplicatedInsertedBlocks'",
      ),
    );
  const measures: Measure[] = [];
  const detail: Record<string, unknown> = { window: a.dedupWindow, windowBefore: before };
  const tries: { case: string; ok: boolean; error?: string }[] = [];
  await aux.command({
    query: `ALTER TABLE ${table} MODIFY SETTING non_replicated_deduplication_window = ${a.dedupWindow}`,
  });
  try {
    detail.windowDuring = await windowNow();
    const cases = [
      { name: 'reinsert_token', token: true, id: NEW_ORDER_BASE_43 + 50_000 + a.rep * 100_000 },
      { name: 'reinsert_hash', token: false, id: NEW_ORDER_BASE_43 + 50_001 + a.rep * 100_000 },
    ];
    const perCase: Record<string, unknown> = {};
    for (const c of cases) {
      const orderNo = no(c.name);
      const settings: Record<string, string> = { log_comment: wc };
      if (c.token) settings.insert_deduplication_token = orderNo;
      const d0 = await ev();
      for (let i = 0; i < 2; i++) {
        const r = await attempt(() =>
          ch.insert({
            table,
            values: [chRow({ ...caseRow(base, 'reinsert', orderNo), orderId: c.id })],
            format: 'JSONEachRow',
            clickhouse_settings: settings,
          }),
        );
        tries.push({ case: c.name, ...r });
      }
      const dup = (await ev()) - d0;
      const rows = Number(
        await chScalar(aux, `SELECT count() AS n FROM ${table} WHERE order_no = {o:String}`, { o: orderNo }),
      );
      perCase[c.name] = { token: c.token, duplicatedInsertedBlocksDelta: dup, rows };
      measures.push(
        {
          metric: `rows_same_order_no.${c.name}`,
          unit: 'rows',
          value: rows,
          read: `window_${a.dedupWindow}`,
          structural: true,
        },
        {
          metric: `duplicated_inserted_blocks.${c.name}`,
          unit: 'count',
          value: dup,
          read: `window_${a.dedupWindow}`,
          structural: true,
        },
      );
    }
    detail.cases = perCase;
  } finally {
    await aux.command({ query: `ALTER TABLE ${table} RESET SETTING non_replicated_deduplication_window` });
    detail.windowAfter = await windowNow();
  }
  if (detail.windowAfter !== 0)
    throw new Error(`${table} 중복 제거 윈도우를 되돌리지 못했다(${String(detail.windowAfter)})`);
  for (const [c, v] of Object.entries(acceptedCounts(tries)))
    measures.unshift({
      metric: `accepted_count.${c}`,
      unit: 'count',
      value: v.accepted,
      read: `window_${a.dedupWindow}`,
      structural: true,
      detail: v,
    });
  detail.errors = tries.filter((t) => t.error).map((t) => ({ case: t.case, error: t.error }));
  return { measures, detail };
}

export async function runExp43(ctx: Ctx): Promise<RunResult> {
  const a = ctx.args;
  const tag = `C43-${a.seed}-r${a.rep}-${ctx.runId}`;
  const no = (c: string) => `${tag}-${c}`;
  const base = workOrderRow(a.seed, 1, a.inProgress, ctx.lineIds);
  if (a.variant === 'ch_mt_dedup') return runDedup(ctx, no, base);
  const updIds = targetIds(inProgressIds(a.seed, a.scale, a.inProgress), a.seed, SLOTS.exp43, a.rep, 6);
  const tries: { case: string; ok: boolean; error?: string }[] = [];
  const measures: Measure[] = [];
  const detail: Record<string, unknown> = {
    tag,
    updateTargets: updIds,
    concurrentK: a.k,
    reinsertShape: REINSERT_SHAPE[ctx.store],
  };
  const k = a.k;
  if (ctx.store === 'postgresql') {
    const pool = ctx.pg as Pool;
    // ⓐ의 K개가 커넥션 K개에서 동시에 나가게 미리 연결(풀 max = K · connPlan)
    await pgWarmPool(pool, k);
    // ⓓ — IDENTITY라 order_id를 보내지 않는다: 같은 order_no 재전송(REINSERT_SHAPE)
    const ins = (r: WorkOrderRow) => pool.query(PG_WO_INSERT_SQL, pgParams(r));
    const dup = await Promise.all(
      Array.from({ length: k }, () => attempt(() => ins(caseRow(base, 'dup_order_no', no('a'))))),
    );
    for (const d of dup) tries.push({ case: 'dup_order_no', ...d });
    for (const c of ['missing_line', 'check_target_qty', 'check_planned', 'check_status'] as const)
      tries.push({ case: c, ...(await attempt(() => ins(caseRow(base, c, no(c))))) });
    for (let i = 0; i < 2; i++)
      tries.push({ case: 'reinsert', ...(await attempt(() => ins(caseRow(base, 'reinsert', no('d'))))) });
    for (const [i, kind] of UPDATE_KINDS.entries())
      tries.push({
        case: `update_${kind}`,
        ...(await attempt(() => pool.query(PG_UPDATE_CASES[kind], [updIds[i]]))),
      });
    const cnt = await pool.query<{ o: string; n: string }>(
      'SELECT order_no AS o, count(*) AS n FROM work_order WHERE order_no = ANY($1) GROUP BY 1',
      [[no('a'), no('d')]],
    );
    const by = new Map(cnt.rows.map((x) => [x.o, Number(x.n)]));
    measures.push(
      {
        metric: 'rows_same_order_no.dup_order_no',
        unit: 'rows',
        value: by.get(no('a')) ?? 0,
        read: 'before_merge',
        structural: true,
      },
      {
        metric: 'rows_same_order_no.reinsert',
        unit: 'rows',
        value: by.get(no('d')) ?? 0,
        read: 'before_merge',
        structural: true,
      },
    );
  } else {
    const ch = ctx.ch as ClickHouseClient;
    const aux = ctx.chAux as ClickHouseClient;
    const rmt = a.variant === 'ch_rmt';
    const table = chTable(a.chDb, rmt ? 'work_order_control_rmt' : 'work_order_control');
    const wc = logComment(ctx, 'write');
    let j = 0;
    const newId = () => NEW_ORDER_BASE_43 + a.rep * 100_000 + j++;
    const ins = (r: WorkOrderRow, id: number) =>
      ch.insert({
        table,
        values: [{ ...chRow({ ...r, orderId: id }), ...(rmt ? { version: 1 } : {}) }],
        format: 'JSONEachRow',
        clickhouse_settings: { log_comment: wc },
      });
    // ⓐ의 K개가 소켓 K개에서 동시에 나가게 미리 연결(max_open_connections = K · connPlan)
    await chWarm(ch, k);
    const upSettings = {
      lwu: chUpdatePathSettings('lwu', wc),
      alter: chUpdatePathSettings('alter', wc),
      readBack: PATCH_READ_SETTINGS,
    };
    detail.settingsWritten = upSettings;
    const dupIds = Array.from({ length: k }, () => newId());
    const dup = await Promise.all(
      dupIds.map((id) => attempt(() => ins(caseRow(base, 'dup_order_no', no('a')), id))),
    );
    for (const d of dup) tries.push({ case: 'dup_order_no', ...d });
    for (const c of ['missing_line', 'check_target_qty', 'check_planned', 'check_status'] as const) {
      const id = newId();
      tries.push({ case: c, ...(await attempt(() => ins(caseRow(base, c, no(c)), id))) });
    }
    const ev = () =>
      chScalar(aux, "SELECT sum(value) AS v FROM system.events WHERE event = 'DuplicatedInsertedBlocks'");
    const d0 = Number(await ev());
    const reId = newId();
    for (let i = 0; i < 2; i++)
      tries.push({
        case: 'reinsert',
        ...(await attempt(() => ins(caseRow(base, 'reinsert', no('d')), reId))),
      });
    detail.duplicatedInsertedBlocksDelta = Number(await ev()) - d0;
    // UPDATE 경로
    const readBack = async (id: number) =>
      (
        await chRows<{ q: number; s: string; pe: string; ps: string }>(
          aux,
          `SELECT target_qty AS q, status AS s, toString(planned_end) AS pe, toString(planned_start) AS ps
             FROM ${table}${rmt ? ' FINAL' : ''} WHERE order_id = ${id}`,
          {},
          PATCH_READ_SETTINGS,
        )
      )[0];
    const violated = (kind: (typeof UPDATE_KINDS)[number], r: Awaited<ReturnType<typeof readBack>>) =>
      kind === 'target_qty' ? Number(r?.q) === 0 : kind === 'status' ? r?.s === 'BOGUS' : r?.pe === r?.ps;
    // UPDATE 경로 CHECK 판별은 work_order_control에서만 — RMT는 갱신이 새 버전 삽입이라 INSERT 경로(ⓒ)와 같다(W1 재검수 판정)
    const paths = rmt ? ([] as const) : (['lwu', 'alter'] as const);
    let u = 0;
    for (const path of paths)
      for (const kind of UPDATE_KINDS) {
        const id = updIds[u++] as number;
        const q =
          path === 'lwu'
            ? `UPDATE ${table} SET ${CH_SET[kind]} WHERE order_id = ${id}`
            : `ALTER TABLE ${table} UPDATE ${CH_SET[kind]} WHERE order_id = ${id}`;
        const res = await attempt(() => ch.command({ query: q, clickhouse_settings: upSettings[path] }));
        const ok = res.ok && violated(kind, await readBack(id));
        tries.push({ case: `update_${path}_${kind}`, ok, ...(res.error ? { error: res.error } : {}) });
      }
    // 중복 수 — 머지 전(plain · RMT FINAL) → 수렴 → 머지 뒤
    const rowsOf = async (o: string, final: boolean) =>
      Number(
        await chScalar(
          aux,
          `SELECT count() AS n FROM ${table}${final ? ' FINAL' : ''} WHERE order_no = {o:String}`,
          { o },
        ),
      );
    for (const [c, o] of [
      ['dup_order_no', no('a')],
      ['reinsert', no('d')],
    ] as const) {
      measures.push({
        metric: `rows_same_order_no.${c}`,
        unit: 'rows',
        value: await rowsOf(o, false),
        read: 'before_merge',
        structural: true,
      });
      if (rmt)
        measures.push({
          metric: `rows_same_order_no.${c}`,
          unit: 'rows',
          value: await rowsOf(o, true),
          read: 'final',
          structural: true,
        });
    }
    if (rmt) {
      // FINAL 비용(분포) — 머지 전 상태별 건수 · FINAL 대 비 FINAL
      for (const fin of [false, true]) {
        const c = logComment(ctx, fin ? 'final' : 'nofinal');
        const t0 = await chNow(aux);
        const lat: number[] = [];
        for (let i = 0; i < a.finalRepeat; i++) {
          const s = now();
          await chRows(
            aux,
            `SELECT status, count() AS n FROM ${table}${fin ? ' FINAL' : ''} GROUP BY status`,
            {},
            { log_comment: c },
          );
          lat.push(now() - s);
        }
        const sv = await chServerTime(aux, c, t0);
        const d = dist(lat);
        const read = fin ? 'final' : 'no_final';
        measures.push(
          {
            metric: 'status_count_latency_p50',
            unit: 'ms',
            value: d.p50,
            read,
            detail: { client: d, server: sv },
          },
          { metric: 'status_count_read_rows', unit: 'rows', value: sv.readRowsMean, read },
        );
      }
    }
    if (a.converge !== 'skip') {
      // 한 호출 안에서 두 라벨(M1) — 자연 대기 → after_wait → OPTIMIZE FINAL → after_force
      const converge: Record<string, unknown> = {};
      detail.converge = converge;
      const rowsAt = async (label: ConvergeRead, conv: Record<string, unknown>) => {
        converge[label] = conv;
        for (const [c, o] of [
          ['dup_order_no', no('a')],
          ['reinsert', no('d')],
        ] as const)
          measures.push({
            metric: `rows_same_order_no.${c}`,
            unit: 'rows',
            value: await rowsOf(o, false),
            read: label,
            structural: true,
            detail: conv,
          });
      };
      // 수렴 = 미완 mutation 0 (+ 강제 단계는 강제 문장 성공) · active patch 파트 수는 관측값(리드 판정)
      const s1 = await chSettle(aux, a.chDb, a.settleMaxSec, 2);
      const l1 = s1.samples[s1.samples.length - 1];
      await rowsAt('after_wait', {
        forced: null,
        forceOk: null,
        converged: convergedOf({ mutationsPending: l1?.mutationsPending, forceOk: null }),
        activePatchParts: l1?.patchParts ?? null,
        waitedSec: s1.waitedSec,
        settleStable: s1.converged,
        last: l1,
      });
      const forced = forceStatement43(table);
      const f0 = now();
      let forceOk = true;
      let forceError: string | null = null;
      try {
        await aux.command({ query: forced, clickhouse_settings: { log_comment: logComment(ctx, 'force') } });
      } catch (e) {
        forceOk = false;
        forceError = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      }
      const forceMs = Math.round(now() - f0);
      const s2 = await chSettle(aux, a.chDb, a.settleMaxSec, 2);
      const l2 = s2.samples[s2.samples.length - 1];
      await rowsAt('after_force', {
        forced,
        forceOk,
        forceError,
        forceMs,
        converged: convergedOf({ mutationsPending: l2?.mutationsPending, forceOk }),
        activePatchParts: l2?.patchParts ?? null,
        waitedSec: s2.waitedSec,
        settleStable: s2.converged,
        last: l2,
      });
    }
  }
  const acc = acceptedCounts(tries);
  detail.errors = tries.filter((t) => t.error).map((t) => ({ case: t.case, error: t.error }));
  for (const [c, v] of Object.entries(acc))
    measures.unshift({
      metric: `accepted_count.${c}`,
      unit: 'count',
      value: v.accepted,
      read: null,
      structural: true,
      detail: v,
    });
  return { measures, detail };
}
