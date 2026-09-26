// EXP-42 원자성 · 동시 갱신 — 구조 판정(3회 전부) · 지연은 비교하지 않는다(CH 쪽 완료 단위가 문장 하나 적다 — 감사 대조 테이블 없음)
// 완료 단위 — PostgreSQL: 한 트랜잭션(조건부 UPDATE + production_log INSERT + audit_log INSERT) · 갱신 0행이면 ROLLBACK하고 중단
//              ClickHouse: 경량 UPDATE + production_log_control INSERT — 갱신 행 수를 응답이 주면 같은 규칙(0행이면 중단)을 적용하고,
//              주지 않으면 적용할 입력이 없어 그대로 진행한다(그것이 관측이다 · 앞 조회로 흉내 내지 않는다 — 공정성 규칙 7)
// ClickHouse 두 팔 — 세션 설정 update_parallel_mode auto(서버 기본) · sync(--update-parallel-mode) · 서버 기본값과 문장이 받은 설정을 원시에(W1 검수 판정)
// 실패 주입 — 두 저장소 모두 첫 문장(상태 갱신) 뒤 · 둘째 문장 전에 프로세스가 죽은 모양:
//   PostgreSQL은 COMMIT · ROLLBACK 없이 커넥션을 끊는다(서버가 열린 트랜잭션을 버린다) · ClickHouse는 둘째 문장을 보내지 않는다.
import type { Pool } from 'pg';
import { type Ctx, chTable, logComment, type Measure, type RunResult } from './oltp-context';
import { rowCountReported } from './oltp-fill';
import { inProgressIds, SLOTS, targetIds } from './oltp-rows';
import { atomicCounts } from './oltp-stats';
import {
  chNow,
  chRows,
  chServerTime,
  LWU_WRITE_SETTINGS,
  oltpPgClient,
  PATCH_READ_SETTINGS,
} from './oltp-stores';
import { PG_UPDATE_SQL } from './oltp-update';

export const PG_LOG_INSERT_SQL =
  'INSERT INTO production_log (order_id, recorded_at, good_qty, defect_qty) VALUES ($1, $2, $3, $4)';
export const PG_AUDIT_INSERT_SQL = `INSERT INTO audit_log (user_id, action, target_table, target_key, before_value, after_value)
VALUES (NULL, $1, $2, $3, $4, $5)`;
/** ClickHouse log_id 발급 — EXP-42 대역(채움 · 다른 실험과 겹치지 않는다) */
export const LOG_ID_BASE_42 = 42_000_000_000;

type Outcome = 'completed' | 'skipped' | 'failed';

async function pgUnit(
  pool: Pool,
  id: number,
  at: Date,
): Promise<{ outcome: Outcome; rowCount: number | null; error?: string }> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const u = await c.query(PG_UPDATE_SQL, [id, 'COMPLETED', 'IN_PROGRESS']);
    if (u.rowCount === 0) {
      await c.query('ROLLBACK');
      return { outcome: 'skipped', rowCount: 0 };
    }
    await c.query(PG_LOG_INSERT_SQL, [id, at.toISOString(), 10, 0]);
    await c.query(PG_AUDIT_INSERT_SQL, [
      'UPDATE',
      'work_order',
      String(id),
      JSON.stringify({ status: 'IN_PROGRESS' }),
      JSON.stringify({ status: 'COMPLETED' }),
    ]);
    await c.query('COMMIT');
    return { outcome: 'completed', rowCount: u.rowCount };
  } catch (e) {
    await c.query('ROLLBACK').catch(() => undefined);
    return { outcome: 'failed', rowCount: null, error: e instanceof Error ? e.message : String(e) };
  } finally {
    c.release();
  }
}

/**
 * ClickHouse 완료 단위 문장 설정 — 경량 UPDATE 켜짐(enable_lightweight_update 1) · 팔(update_parallel_mode)을 문장에 명시(M2 · W1 검수 판정).
 * 되읽기는 apply_patch_parts 1(PATCH_READ_SETTINGS) — 서버 기본값에 기대지 않는다.
 */
export function chUnitSettings(mode: 'auto' | 'sync', comment: string): Record<string, string | number> {
  return { ...LWU_WRITE_SETTINGS, update_parallel_mode: mode, log_comment: comment };
}

/** 요약에서 갱신 행 수 — 판별이 "실린다"일 때만 written_rows를 쓴다 · 아니면 null(입력 없음) */
export function affectedRows(summary: object | undefined, reported: boolean): number | null {
  if (!reported || !summary) return null;
  const v = Number((summary as Record<string, unknown>).written_rows);
  return Number.isFinite(v) ? v : null;
}

export async function runExp42(ctx: Ctx): Promise<RunResult> {
  const a = ctx.args;
  // 대상 = 슬롯 1의 rep 조각 — ClickHouse 두 팔(update_parallel_mode auto · sync)이 같은 반복에서 겹치지 않게 조각을 반으로 나눈다
  const per = a.inject + a.pairs + 2;
  const all2 = targetIds(inProgressIds(a.seed, a.scale, a.inProgress), a.seed, SLOTS.exp42, a.rep, per * 2);
  const ids =
    ctx.store === 'clickhouse' && a.updateParallelMode === 'sync' ? all2.slice(per) : all2.slice(0, per);
  const injectIds = ids.slice(0, a.inject);
  const pairIds = ids.slice(a.inject, a.inject + a.pairs);
  const probeIds = ids.slice(a.inject + a.pairs);
  const detail: Record<string, unknown> = { inject: injectIds.length, pairs: pairIds.length };
  const at = new Date();
  let orders: { id: number; completed: boolean; logs: number }[];
  if (ctx.store === 'postgresql') {
    const pool = ctx.pg;
    if (!pool) throw new Error('PostgreSQL 접속 없음');
    // 실패 주입 — 전용 커넥션으로 BEGIN · 첫 문장 뒤 끊는다
    const injected: (number | null)[] = [];
    for (const id of injectIds) {
      const c = await oltpPgClient({ url: ctx.pgUrl, schema: a.pgSchema, synchronousCommit: 'off' });
      await c.query('BEGIN');
      const u = await c.query(PG_UPDATE_SQL, [id, 'COMPLETED', 'IN_PROGRESS']);
      injected.push(u.rowCount);
      await c.end();
    }
    // 쌍마다 두 완료를 동시에(커넥션 2) — 쌍끼리는 차례로(풀 대기가 두 요청의 겹침을 흩지 않게)
    const pairs: Awaited<ReturnType<typeof pgUnit>>[][] = [];
    for (const id of pairIds) pairs.push(await Promise.all([pgUnit(pool, id, at), pgUnit(pool, id, at)]));
    detail.injectFirstRowCount = injected;
    detail.pairOutcomes = pairs.map((p) => p.map((x) => x.outcome));
    detail.pairErrors = pairs
      .flat()
      .filter((x) => x.error)
      .map((x) => x.error);
    const all = [...injectIds, ...pairIds];
    const r = await pool.query<{ order_id: string; status: string; logs: string }>(
      `SELECT w.order_id, w.status, (SELECT count(*) FROM production_log p WHERE p.order_id = w.order_id) AS logs
         FROM work_order w WHERE w.order_id = ANY($1::bigint[])`,
      [all],
    );
    orders = r.rows.map((x) => ({
      id: Number(x.order_id),
      completed: x.status === 'COMPLETED',
      logs: Number(x.logs),
    }));
  } else {
    const ch = ctx.ch;
    if (!ch) throw new Error('ClickHouse 접속 없음');
    const wo = chTable(a.chDb, 'work_order_control');
    const pl = chTable(a.chDb, 'production_log_control');
    const wc = logComment(ctx, 'unit');
    // 경량 UPDATE 동시 실행 일관성(W1 검수 판정) — 팔마다 세션 설정으로 준다 · 서버 기본값과 문장이 받은 설정을 원시에
    const cs = chUnitSettings(a.updateParallelMode, wc);
    const aux = ctx.chAux ?? ch;
    const t0 = await chNow(aux);
    const [def] = await chRows<{ v: string }>(
      aux,
      "SELECT value AS v FROM system.settings WHERE name = 'update_parallel_mode'",
    );
    detail.updateParallelMode = { used: a.updateParallelMode, serverDefault: def?.v ?? null };
    detail.settingsWritten = { unit: cs, readBack: PATCH_READ_SETTINGS };
    const upd = (id: number) =>
      `UPDATE ${wo} SET status = 'COMPLETED' WHERE order_id = ${id} AND status = 'IN_PROGRESS'`;
    // 이 실행 안의 판별 — 맞은 문장과 빗나간 문장의 응답 요약 비교(탐침 대상 2건: 하나는 맞히고 같은 문장을 다시)
    const hit = await ch.command({
      query: upd(probeIds[0] as number),
      clickhouse_settings: cs,
    });
    const miss = await ch.command({
      query: upd(probeIds[0] as number),
      clickhouse_settings: cs,
    });
    const reported = rowCountReported(hit.summary, miss.summary);
    detail.rowCount = { reported, hit: hit.summary, miss: miss.summary };
    let seq = 0;
    const logId = () => LOG_ID_BASE_42 + a.rep * 10_000_000 + seq++;
    const unit = async (
      id: number,
    ): Promise<{ outcome: Outcome; affected: number | null; error?: string }> => {
      try {
        const u = await ch.command({ query: upd(id), clickhouse_settings: cs });
        const affected = affectedRows(u.summary, reported);
        if (affected === 0) return { outcome: 'skipped', affected };
        await ch.insert({
          table: pl,
          values: [{ log_id: logId(), order_id: id, recorded_at: at.getTime(), good_qty: 10, defect_qty: 0 }],
          format: 'JSONEachRow',
          clickhouse_settings: cs,
        });
        return { outcome: 'completed', affected };
      } catch (e) {
        return { outcome: 'failed', affected: null, error: e instanceof Error ? e.message : String(e) };
      }
    };
    for (const id of injectIds) await ch.command({ query: upd(id), clickhouse_settings: cs });
    const pairs: Awaited<ReturnType<typeof unit>>[][] = [];
    for (const id of pairIds) pairs.push(await Promise.all([unit(id), unit(id)]));
    detail.pairOutcomes = pairs.map((p) => p.map((x) => x.outcome));
    detail.pairErrors = pairs
      .flat()
      .filter((x) => x.error)
      .map((x) => x.error);
    const all = [...injectIds, ...pairIds];
    const st = await chRows<{ order_id: string; status: string }>(
      ch,
      `SELECT order_id, status FROM ${wo} WHERE order_id IN (${all.join(',')})`,
      {},
      PATCH_READ_SETTINGS,
    );
    const lg = await chRows<{ order_id: string; n: string }>(
      ch,
      `SELECT order_id, count() AS n FROM ${pl} WHERE order_id IN (${all.join(',')}) GROUP BY order_id`,
    );
    const logs = new Map(lg.map((x) => [Number(x.order_id), Number(x.n)]));
    detail.server = await chServerTime(aux, wc, t0);
    orders = st.map((x) => ({
      id: Number(x.order_id),
      completed: x.status === 'COMPLETED',
      logs: logs.get(Number(x.order_id)) ?? 0,
    }));
  }
  // 판독 라벨 — ClickHouse는 팔(update_parallel_mode)을 붙여 두 팔이 다른 행이 된다
  const arm = ctx.store === 'clickhouse' ? `:upm_${a.updateParallelMode}` : '';
  const injSet = new Set(injectIds);
  const inj = atomicCounts(orders.filter((o) => injSet.has(o.id)));
  const par = atomicCounts(orders.filter((o) => !injSet.has(o.id)));
  detail.inject = { ...inj, n: injectIds.length };
  detail.pairsResult = { ...par, n: pairIds.length };
  const measures: Measure[] = [
    {
      metric: 'partial_apply_count',
      unit: 'count',
      value: inj.partialApply,
      read: `inject${arm}`,
      structural: true,
      detail: detail.inject,
    },
    {
      metric: 'race_violation_count',
      unit: 'count',
      value: par.raceViolation,
      read: `pairs${arm}`,
      structural: true,
      detail: detail.pairsResult,
    },
    {
      metric: 'pair_partial_apply_count',
      unit: 'count',
      value: par.partialApply,
      read: `pairs${arm}`,
      structural: true,
    },
  ];
  if (ctx.store === 'clickhouse') {
    const rc = detail.rowCount as { reported: boolean };
    measures.push({
      metric: 'update_row_count_reported',
      unit: 'bool',
      value: rc.reported ? 1 : 0,
      read: `probe${arm}`,
      structural: true,
    });
  }
  return { measures, detail };
}
