// 채우기 · 판별 탐침 · ClickHouse 수렴 대기
// 채우기 — PostgreSQL COPY(work_order · IDENTITY가 1..N 발급) · ClickHouse INSERT(같은 행 벡터 · 실행기가 같은 order_id를 싣는다)
//   채운 뒤 (order_id · order_no) 집합을 두 저장소에서 md5로 대조한다 — 어긋나면 그 단계는 무효(05_data_stores/10 §업무 규모 격자와 채우기).
//   채우기는 감사하지 않는다(시드와 같은 판정) — production_log · audit_log는 채우지 않는다.
// 탐침 — 판별 대상 4(UPDATE 갱신 행 수 응답 · UPDATE 경로 CHECK · index_granularity MODIFY 거부 · 윈도우 0 DuplicatedInsertedBlocks)를
//   plc 밖 탐침 DB에서 판별하고 지운다(05_data_stores/10 §미확인 · 미설계 등재 · 06_experiment_catalog 미확인 행).
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ClickHouseClient } from '@clickhouse/client';
import type { Client } from 'pg';
import { from as copyFrom } from 'pg-copy-streams';
import { chTable, PROBE_DB, productionLogControlDdl, WO_COLUMNS, workOrderControlDdl } from './oltp-context';
import type { FillArgs } from './oltp-options';
import { chRow, pgCopyLine, statusOf, workOrderRow } from './oltp-rows';
import { CH_RECORDED_SETTINGS, chRows, chScalar, now, sleep } from './oltp-stores';

export const PG_COPY_SQL =
  'COPY work_order (line_id, order_no, product_code, target_qty, planned_start, planned_end, status) FROM STDIN';
const COPY_CHUNK_ROWS = 5_000;

/** (order_id · order_no) 집합 지문 — 두 저장소 같은 문자열 규칙('id:no'를 order_id 순으로 ',' 연결)의 md5 */
export const PG_SET_MD5_SQL = `SELECT md5(coalesce(string_agg(order_id::text || ':' || order_no, ',' ORDER BY order_id), '')) AS h,
       count(*)::bigint AS n FROM work_order WHERE order_id <= $1`;
export function chSetMd5Sql(table: string): string {
  return `SELECT lower(hex(MD5(arrayStringConcat(arrayMap(x -> concat(toString(x.1), ':', x.2),
                 arraySort(groupArray((order_id, order_no)))), ',')))) AS h, count() AS n
            FROM ${table} WHERE order_id <= {scale:UInt64}`;
}

export async function pgLineIds(pg: Pick<Client, 'query'>): Promise<number[]> {
  const r = await pg.query<{ line_id: number }>('SELECT line_id FROM production_line ORDER BY line_id');
  if (r.rows.length === 0) throw new Error('production_line이 비었다 — 시드(마스터) 뒤에 채운다(FK)');
  return r.rows.map((x) => Number(x.line_id));
}

function* copyChunks(a: FillArgs, lineIds: readonly number[]): Generator<string> {
  let buf = '';
  for (let i = 1; i <= a.scale; i++) {
    buf += pgCopyLine(workOrderRow(a.seed, i, a.inProgress, lineIds));
    if (i % COPY_CHUNK_ROWS === 0) {
      yield buf;
      buf = '';
    }
  }
  if (buf) yield buf;
}

function* chObjects(a: FillArgs, lineIds: readonly number[]): Generator<Record<string, unknown>> {
  for (let i = 1; i <= a.scale; i++) yield chRow(workOrderRow(a.seed, i, a.inProgress, lineIds));
}

export async function fill(a: FillArgs, pg: Client, ch: ClickHouseClient): Promise<Record<string, unknown>> {
  const lineIds = await pgLineIds(pg);
  const out: Record<string, unknown> = { lineIds };
  if (a.stores === 'both') {
    const [have] = (
      await pg.query<{ n: string; mx: string | null }>(
        'SELECT count(*) AS n, max(order_id) AS mx FROM work_order',
      )
    ).rows;
    if (Number(have?.n ?? 0) !== 0)
      throw new Error(
        `work_order에 ${have?.n}행이 있다 — 빈 업무 테이블(빈 볼륨 · 채움 전 스냅샷)에서만 채운다`,
      );
    const t0 = now();
    await pg.query('BEGIN');
    try {
      await pipeline(Readable.from(copyChunks(a, lineIds)), pg.query(copyFrom(PG_COPY_SQL)));
      await pg.query('COMMIT');
    } catch (e) {
      await pg.query('ROLLBACK').catch(() => undefined);
      throw e;
    }
    out.pgCopyMs = Math.round(now() - t0);
    const [ids] = (
      await pg.query<{ lo: string; hi: string; n: string }>(
        'SELECT min(order_id) AS lo, max(order_id) AS hi, count(*) AS n FROM work_order',
      )
    ).rows;
    // IDENTITY는 빈 볼륨에서 1부터 — 아니면 ClickHouse가 실을 번호가 PostgreSQL과 다르다
    if (Number(ids?.lo) !== 1 || Number(ids?.hi) !== a.scale || Number(ids?.n) !== a.scale)
      throw new Error(
        `IDENTITY 발급이 1..${a.scale}이 아니다(min ${ids?.lo} · max ${ids?.hi} · n ${ids?.n}) — 빈 볼륨에서 다시 채운다(단계 무효)`,
      );
  }
  const wo = chTable(a.chDb, 'work_order_control');
  const rmt = chTable(a.chDb, 'work_order_control_rmt');
  const plc = chTable(a.chDb, 'production_log_control');
  for (const t of [wo, rmt, plc]) await ch.command({ query: `TRUNCATE TABLE ${t}` });
  const t1 = now();
  await ch.insert({
    table: wo,
    values: Readable.from(chObjects(a, lineIds)),
    format: 'JSONEachRow',
    clickhouse_settings: { insert_deduplicate: 0 },
  });
  out.chInsertMs = Math.round(now() - t1);
  const t2 = now();
  await ch.command({
    query: `INSERT INTO ${rmt} (${WO_COLUMNS}, version) SELECT ${WO_COLUMNS}, 1 FROM ${wo}`,
    clickhouse_settings: { insert_deduplicate: 0 },
  });
  out.chRmtInsertMs = Math.round(now() - t2);
  const [p] = (await pg.query<{ h: string; n: string }>(PG_SET_MD5_SQL, [a.scale])).rows;
  const [c1] = await chRows<{ h: string; n: string }>(ch, chSetMd5Sql(wo), { scale: a.scale });
  const [c2] = await chRows<{ h: string; n: string }>(ch, chSetMd5Sql(rmt), { scale: a.scale });
  const statusPg = (
    await pg.query<{ s: string; n: string }>(
      'SELECT status AS s, count(*)::bigint AS n FROM work_order WHERE order_id <= $1 GROUP BY 1 ORDER BY 1',
      [a.scale],
    )
  ).rows.map((x) => [x.s, Number(x.n)]);
  const statusCh = (
    await chRows<{ s: string; n: string }>(
      ch,
      `SELECT status AS s, count() AS n FROM ${wo} GROUP BY s ORDER BY s`,
    )
  ).map((x) => [x.s, Number(x.n)]);
  // 상태 분포는 행 벡터의 기대값과 대조한다 — ClickHouse만 다시 채울 때 PostgreSQL은 앞 변형의 갱신을 담고 있을 수 있다
  const expected = new Map<string, number>();
  for (let i = 1; i <= a.scale; i++) {
    const s = statusOf(a.seed, i, a.inProgress);
    expected.set(s, (expected.get(s) ?? 0) + 1);
  }
  const statusExp = [...expected.entries()].sort(([x], [y]) => (x < y ? -1 : 1));
  out.set = {
    pg: { md5: p?.h, n: Number(p?.n) },
    ch: { md5: c1?.h, n: Number(c1?.n) },
    chRmt: { md5: c2?.h, n: Number(c2?.n) },
  };
  out.status = { expected: statusExp, pg: statusPg, ch: statusCh };
  const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);
  out.match =
    p?.h === c1?.h &&
    p?.h === c2?.h &&
    Number(p?.n) === a.scale &&
    same(statusCh, statusExp) &&
    (a.stores === 'clickhouse' || same(statusPg, statusExp));
  return out;
}

export interface SettleResult {
  converged: boolean;
  waitedSec: number;
  samples: { parts: number; patchParts: number; merges: number; mutationsPending: number }[];
}

/** 대상 DB 대조 테이블의 활성 파트 수가 표본 3번 불변 · 머지 0 · 미완 mutation 0이면 수렴(상한 maxSec) */
export async function chSettle(
  ch: ClickHouseClient,
  db: string,
  maxSec: number,
  intervalSec: number,
): Promise<SettleResult> {
  const t0 = Date.now();
  const samples: SettleResult['samples'] = [];
  const tables = ['work_order_control', 'work_order_control_rmt', 'production_log_control'];
  for (;;) {
    const [r] = await chRows<{ a: string; pp: string; m: string; mu: string }>(
      ch,
      `SELECT (SELECT countIf(NOT startsWith(name, 'patch-')) FROM system.parts WHERE database = {db:String} AND table IN {t:Array(String)} AND active) AS a,
              (SELECT countIf(startsWith(name, 'patch-')) FROM system.parts WHERE database = {db:String} AND table IN {t:Array(String)} AND active) AS pp,
              (SELECT count() FROM system.merges WHERE database = {db:String} AND table IN {t:Array(String)}) AS m,
              (SELECT countIf(NOT is_done) FROM system.mutations WHERE database = {db:String} AND table IN {t:Array(String)}) AS mu`,
      { db, t: tables },
    );
    const s = {
      parts: Number(r?.a),
      patchParts: Number(r?.pp),
      merges: Number(r?.m),
      mutationsPending: Number(r?.mu),
    };
    samples.push(s);
    const last3 = samples.slice(-3);
    const stable =
      last3.length === 3 &&
      last3.every((x) => x.parts === s.parts && x.merges === 0 && x.mutationsPending === 0);
    const waitedSec = Math.round((Date.now() - t0) / 100) / 10;
    if (stable) return { converged: true, waitedSec, samples };
    if (waitedSec >= maxSec) return { converged: false, waitedSec, samples };
    await sleep(intervalSec * 1000);
  }
}

async function chTry(
  fn: () => Promise<unknown>,
): Promise<{ ok: boolean; code: number | null; message: string | null; result?: unknown }> {
  try {
    const result = await fn();
    return { ok: true, code: null, message: null, result };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return {
      ok: false,
      code: err.code ? Number(err.code) : null,
      message: (err.message ?? String(e)).slice(0, 300),
    };
  }
}

/** UPDATE 응답 요약에 갱신 행 수가 실리는가 — 맞은 문장과 빗나간 문장의 요약 중 행 수 계열이 다르면 실린다 */
export function rowCountReported(hit: object | undefined, miss: object | undefined): boolean {
  if (!hit || !miss) return false;
  const h = hit as Record<string, unknown>;
  const m = miss as Record<string, unknown>;
  return ['written_rows', 'result_rows'].some((k) => h[k] !== undefined && h[k] !== m[k]);
}

/** 판별 대상 4 — plc 밖 탐침 DB에서(남은 것이 있으면 먼저 지운다 · 끝에 지운다) */
export async function probe(ch: ClickHouseClient): Promise<Record<string, unknown>> {
  const stale = Number(
    await chScalar(ch, 'SELECT count() AS n FROM system.databases WHERE name = {d:String}', { d: PROBE_DB }),
  );
  await ch.command({ query: `DROP DATABASE IF EXISTS ${PROBE_DB} SYNC` });
  await ch.command({ query: `CREATE DATABASE ${PROBE_DB}` });
  try {
    const wo = `${PROBE_DB}.work_order_control`;
    const pl = `${PROBE_DB}.production_log_control`;
    await ch.command({ query: workOrderControlDdl(PROBE_DB, 8192) });
    await ch.command({ query: productionLogControlDdl(PROBE_DB) });
    await ch.command({
      query: `INSERT INTO ${wo} (${WO_COLUMNS}) SELECT number + 1, 1, concat('P-', toString(number + 1)), 'P-001', 10,
                 toDateTime64('2026-01-01 00:00:00', 3, 'Asia/Seoul'), toDateTime64('2026-01-02 00:00:00', 3, 'Asia/Seoul'), 'IN_PROGRESS'
                 FROM numbers(10)`,
    });
    const upd = (id: number) =>
      `UPDATE ${wo} SET status = 'COMPLETED' WHERE order_id = ${id} AND status = 'IN_PROGRESS'`;
    const alt = (id: number) =>
      `ALTER TABLE ${wo} UPDATE status = 'COMPLETED' WHERE order_id = ${id} AND status = 'IN_PROGRESS'`;
    const lwuHit = await ch.command({ query: upd(1) });
    const lwuMiss = await ch.command({ query: upd(1) });
    const altHit = await ch.command({ query: alt(2), clickhouse_settings: { mutations_sync: '1' } });
    const altMiss = await ch.command({ query: alt(2), clickhouse_settings: { mutations_sync: '1' } });
    const rowCount = {
      lightweight: {
        hit: lwuHit.summary,
        miss: lwuMiss.summary,
        reported: rowCountReported(lwuHit.summary, lwuMiss.summary),
      },
      alterSync: {
        hit: altHit.summary,
        miss: altMiss.summary,
        reported: rowCountReported(altHit.summary, altMiss.summary),
      },
    };
    // UPDATE 경로 CHECK — 오류 여부와 되읽은 값(오류 없이 위반 값이 남으면 검사하지 않은 것)
    const readBack = async (id: number) =>
      (
        await chRows<{ q: number; s: string; pe: string; ps: string }>(
          ch,
          `SELECT target_qty AS q, status AS s, toString(planned_end) AS pe, toString(planned_start) AS ps FROM ${wo} WHERE order_id = ${id}`,
        )
      )[0];
    const checkCases: [
      string,
      string,
      (r: { q: number; s: string; pe: string; ps: string } | undefined) => boolean,
    ][] = [
      ['lwu_target_qty', `UPDATE ${wo} SET target_qty = 0 WHERE order_id = 3`, (r) => Number(r?.q) === 0],
      ['lwu_status', `UPDATE ${wo} SET status = 'BOGUS' WHERE order_id = 4`, (r) => r?.s === 'BOGUS'],
      [
        'lwu_planned',
        `UPDATE ${wo} SET planned_end = planned_start WHERE order_id = 5`,
        (r) => r?.pe === r?.ps,
      ],
      [
        'alter_target_qty',
        `ALTER TABLE ${wo} UPDATE target_qty = 0 WHERE order_id = 6`,
        (r) => Number(r?.q) === 0,
      ],
      [
        'alter_status',
        `ALTER TABLE ${wo} UPDATE status = 'BOGUS' WHERE order_id = 7`,
        (r) => r?.s === 'BOGUS',
      ],
      [
        'alter_planned',
        `ALTER TABLE ${wo} UPDATE planned_end = planned_start WHERE order_id = 8`,
        (r) => r?.pe === r?.ps,
      ],
    ];
    const checkUpdatePath: Record<string, unknown> = {};
    for (const [name, q, violated] of checkCases) {
      const id = Number(/order_id = (\d+)/.exec(q)?.[1]);
      const res = await chTry(() => ch.command({ query: q, clickhouse_settings: { mutations_sync: '1' } }));
      const back = await readBack(id);
      checkUpdatePath[name] = {
        error: res.ok ? null : { code: res.code, message: res.message },
        accepted: res.ok && violated(back),
      };
    }
    const checkInsert = await chTry(() =>
      ch.command({
        query: `INSERT INTO ${wo} (${WO_COLUMNS}) VALUES (100, 1, 'X', 'P-001', 0, '2026-01-01 00:00:00', '2026-01-02 00:00:00', 'PLANNED')`,
      }),
    );
    const modify = await chTry(() =>
      ch.command({ query: `ALTER TABLE ${wo} MODIFY SETTING index_granularity = 256` }),
    );
    const events = async () =>
      Number(
        await chScalar(
          ch,
          "SELECT sum(value) AS v FROM system.events WHERE event = 'DuplicatedInsertedBlocks'",
        ),
      );
    const d0 = await events();
    const row = `INSERT INTO ${pl} VALUES (1, 1, '2026-01-01 00:00:00', 1, 0)`;
    await ch.command({ query: row });
    await ch.command({ query: row });
    const d1 = await events();
    const [win] = await chRows<{ v: string }>(
      ch,
      "SELECT value AS v FROM system.merge_tree_settings WHERE name = 'non_replicated_deduplication_window'",
    );
    const dupRows = Number(await chScalar(ch, `SELECT count() AS n FROM ${pl}`));
    return {
      staleProbeDbDropped: stale > 0,
      updateRowCount: rowCount,
      checkUpdatePath,
      checkInsertPath: { accepted: checkInsert.ok, code: checkInsert.code, message: checkInsert.message },
      modifyGranularity: { refused: !modify.ok, code: modify.code, message: modify.message },
      dedupWindow0: {
        window: win?.v ?? null,
        duplicatedInsertedBlocksDelta: d1 - d0,
        identicalInserts: 2,
        rowsAfter: dupRows,
      },
    };
  } finally {
    await ch.command({ query: `DROP DATABASE IF EXISTS ${PROBE_DB} SYNC` });
  }
}

/** 판별 · 조건 기록 — 서버 버전 · 변형 쿼리 설정 기본값 · 대조 테이블 설정 문자열(공정성 규칙 6) */
export async function chConditions(ch: ClickHouseClient, db: string): Promise<Record<string, unknown>> {
  const version = await chScalar(ch, 'SELECT version() AS v');
  const settings = await chRows<{ name: string; value: string; changed: number }>(
    ch,
    'SELECT name, value, changed FROM system.settings WHERE name IN ({n:Array(String)}) ORDER BY name',
    { n: CH_RECORDED_SETTINGS },
  );
  const server = await chRows<{ name: string; value: string }>(
    ch,
    "SELECT name, value FROM system.server_settings WHERE name IN ('max_concurrent_queries', 'background_pool_size', 'async_insert_threads') ORDER BY name",
  );
  const tables = await chRows<{ name: string; engine_full: string }>(
    ch,
    `SELECT name, engine_full FROM system.tables WHERE database = {db:String}
        AND name IN ('work_order_control', 'work_order_control_rmt', 'production_log_control') ORDER BY name`,
    { db },
  );
  return { version, settings, server, tables };
}
