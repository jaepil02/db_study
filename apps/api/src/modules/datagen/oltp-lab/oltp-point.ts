// EXP-41 PK 점조회 — 동시성 c의 작업자가 같은 order_id 순서를 나눠 조회 · 예열 1회(같은 순서의 앞 warmup개) 뒤 측정(웜)
// 서버 쪽 — ClickHouse query_log read_rows(조회당) · PostgreSQL EXPLAIN (ANALYZE, BUFFERS) 표본의 읽은 블록 · 도구 CPU(process.cpuUsage)
//   · 측정 창 이벤트 루프 사용률(detail.eventLoop — 기록만 · 판정 미적용)
// ch_g256 — plc 밖 실험 DB에 같은 DDL을 granularity 256으로 만들고 같은 행을 INSERT SELECT로 채운 뒤 끝에 지운다(시작 전 부재 확인)
//   05_data_stores/10 §그래뉼 변형 판정 ② — 문 해시를 원시에 남긴다.
import { createHash } from 'node:crypto';
import { availableParallelism } from 'node:os';
import { performance } from 'node:perf_hooks';
import type { ClickHouseClient } from '@clickhouse/client';
import {
  type Ctx,
  chTable,
  G256_DB,
  logComment,
  type Measure,
  type RunResult,
  WO_COLUMNS,
  workOrderControlDdl,
} from './oltp-context';
import { chSettle } from './oltp-fill';
import { hash32 } from './oltp-rows';
import { dist } from './oltp-stats';
import {
  chNow,
  chRows,
  chScalar,
  chServerTime,
  now,
  pgStmtMean,
  pgStmtStat,
  pgWarmPool,
} from './oltp-stores';
import { PG_R1_SQL } from './oltp-update';

/** 조회 k번째 order_id — 1..scale 균등 · 반복마다 다른 순서 */
export function pointId(seed: number, rep: number, scale: number, k: number): number {
  return (hash32(seed, k, 41 + rep) % scale) + 1;
}

/** 동시성 c로 total개를 돌린다 — 작업자가 공유 카운터에서 번호를 받는다 · 지연(ms) 배열 */
export async function runConcurrent(
  total: number,
  c: number,
  one: (k: number) => Promise<void>,
  offset = 0,
): Promise<number[]> {
  const lat: number[] = new Array(total);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const k = next++;
      if (k >= total) return;
      const s = now();
      await one(offset + k);
      lat[k] = now() - s;
    }
  };
  await Promise.all(Array.from({ length: Math.min(c, total) }, worker));
  return lat;
}

async function g256Create(ch: ClickHouseClient, src: string): Promise<Record<string, unknown>> {
  const exists = Number(
    await chScalar(ch, 'SELECT count() AS n FROM system.databases WHERE name = {d:String}', { d: G256_DB }),
  );
  if (exists > 0)
    throw new Error(
      `${G256_DB}가 이미 있다 — 앞 실행이 지우지 못했다. 확인 뒤 DROP DATABASE ${G256_DB} 하고 다시 한다`,
    );
  const ddl = workOrderControlDdl(G256_DB, 256);
  await ch.command({ query: `CREATE DATABASE ${G256_DB}` });
  await ch.command({ query: ddl });
  const t0 = now();
  await ch.command({
    query: `INSERT INTO ${G256_DB}.work_order_control (${WO_COLUMNS}) SELECT ${WO_COLUMNS} FROM ${src}`,
    clickhouse_settings: { insert_deduplicate: 0 },
  });
  const fillMs = Math.round(now() - t0);
  const settle = await chSettle(ch, G256_DB, 120, 2);
  // 판별 — index_granularity는 생성 뒤 바꿀 수 없는가(26.8) · 실험 DB 테이블에만 시도한다(plc 스키마는 건드리지 않는다)
  let modify: Record<string, unknown>;
  try {
    await ch.command({
      query: `ALTER TABLE ${G256_DB}.work_order_control MODIFY SETTING index_granularity = 8192`,
    });
    modify = { refused: false };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    modify = {
      refused: true,
      code: err.code ? Number(err.code) : null,
      message: (err.message ?? '').slice(0, 300),
    };
  }
  const [cnt] = await chRows<{ a: string; b: string }>(
    ch,
    `SELECT (SELECT count() FROM ${G256_DB}.work_order_control) AS a, (SELECT count() FROM ${src}) AS b`,
  );
  if (cnt?.a !== cnt?.b) throw new Error(`그래뉼 변형 행 수 ${cnt?.a} ≠ 원본 ${cnt?.b}`);
  return {
    db: G256_DB,
    ddlSha256: createHash('sha256').update(ddl).digest('hex'),
    fillMs,
    rows: Number(cnt?.a),
    settle: { converged: settle.converged, waitedSec: settle.waitedSec },
    modifyGranularity: modify,
  };
}

/**
 * 측정 창의 이벤트 루프 사용률(perf_hooks eventLoopUtilization) — 도구 CPU(프로세스 전 스레드 ÷ CPU 2)는 Node 메인 스레드 포화를 가린다
 * (기록 041 PostgreSQL c8 · c32 — 도구 CPU 0.75~0.84인데 qps가 c8 · c32 같은 약 2.2만에서 멈췄다). 기록만 한다 — 포화 창 제외에 쓰는
 * 문턱은 공정성 규칙 10 개정 사항이라 리드 판정 전에는 판정에 쓰지 않는다(리드 판정 2026-09-27 · 도구 포화 (a)안).
 */
export function eventLoopOf(start: ReturnType<typeof performance.eventLoopUtilization>): {
  utilization: number;
  activeMs: number;
  idleMs: number;
} {
  const d = performance.eventLoopUtilization(start);
  return {
    utilization: Math.round(d.utilization * 1000) / 1000,
    activeMs: Math.round(d.active),
    idleMs: Math.round(d.idle),
  };
}

export async function runExp41(ctx: Ctx): Promise<RunResult> {
  const a = ctx.args;
  const c = a.concurrency;
  const measures: Measure[] = [];
  const detail: Record<string, unknown> = {};
  const idOf = (k: number) => pointId(a.seed, a.rep, a.scale, k);
  const cpu0 = process.cpuUsage();
  let wall = 0;
  let lat: number[] = [];
  if (ctx.store === 'postgresql') {
    const pg = ctx.pg;
    const aux = ctx.pgAux;
    if (!pg || !aux) throw new Error('PostgreSQL 접속 없음');
    await pgWarmPool(pg, c);
    await runConcurrent(a.warmup, c, async (k) => void (await pg.query(PG_R1_SQL, [idOf(k)])));
    const st0 = await pgStmtStat(aux, PG_R1_SQL);
    const cpuM = process.cpuUsage();
    const eluM = performance.eventLoopUtilization();
    const t = now();
    lat = await runConcurrent(a.queries, c, async (k) => void (await pg.query(PG_R1_SQL, [idOf(k)])));
    wall = now() - t;
    detail.cpuMeasured = process.cpuUsage(cpuM);
    detail.eventLoop = eventLoopOf(eluM);
    const st1 = await pgStmtStat(aux, PG_R1_SQL);
    // 읽은 블록 — EXPLAIN (ANALYZE, BUFFERS) 표본(측정 창 밖 · 같은 대상 분포)
    const blocks: number[] = [];
    const rowsRead: number[] = [];
    for (let k = 0; k < a.explainSample; k++) {
      const r = await aux.query<{ 'QUERY PLAN': { Plan: Record<string, unknown> }[] }>(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${PG_R1_SQL}`,
        [idOf(k)],
      );
      const plan = r.rows[0]?.['QUERY PLAN']?.[0]?.Plan ?? {};
      blocks.push(Number(plan['Shared Hit Blocks'] ?? 0) + Number(plan['Shared Read Blocks'] ?? 0));
      rowsRead.push(Number(plan['Actual Rows'] ?? 0));
      if (k === 0) detail.explainNode = plan['Node Type'];
    }
    const sm = pgStmtMean(st0, st1);
    detail.server = sm;
    measures.push(
      {
        metric: 'blocks_per_query',
        unit: 'blocks',
        value: dist(blocks).mean,
        read: null,
        detail: dist(blocks),
      },
      { metric: 'rows_per_query', unit: 'rows', value: dist(rowsRead).mean, read: null },
      { metric: 'server_mean', unit: 'ms', value: sm.meanMs, read: null },
    );
  } else {
    const ch = ctx.ch;
    const aux = ctx.chAux;
    if (!ch || !aux) throw new Error('ClickHouse 접속 없음');
    const src = chTable(a.chDb, 'work_order_control');
    let table = src;
    if (a.variant === 'ch_g256') {
      detail.g256 = await g256Create(aux, src);
      table = `${G256_DB}.work_order_control`;
    }
    try {
      const [g] = await chRows<{ g: string }>(
        aux,
        "SELECT extract(engine_full, 'index_granularity = (\\\\d+)') AS g FROM system.tables WHERE database = {d:String} AND name = 'work_order_control'",
        { d: table.split('.')[0] },
      );
      detail.granularity = Number(g?.g);
      const q = (k: number) => `SELECT ${WO_COLUMNS} FROM ${table} WHERE order_id = ${idOf(k)}`;
      const mc = logComment(ctx, 'point');
      await runConcurrent(
        a.warmup,
        c,
        async (k) => void (await chRows(ch, q(k), {}, { log_comment: logComment(ctx, 'warmup') })),
      );
      const t0 = await chNow(aux);
      const cpuM = process.cpuUsage();
      const eluM = performance.eventLoopUtilization();
      const t = now();
      lat = await runConcurrent(
        a.queries,
        c,
        async (k) => void (await chRows(ch, q(k), {}, { log_comment: mc })),
      );
      wall = now() - t;
      detail.cpuMeasured = process.cpuUsage(cpuM);
      detail.eventLoop = eventLoopOf(eluM);
      const server = await chServerTime(aux, mc, t0);
      const explain = await chRows<{ explain: string }>(aux, `EXPLAIN indexes = 1 ${q(0)}`);
      detail.server = server;
      detail.explain = explain.map((x) => x.explain);
      measures.push(
        { metric: 'read_rows_per_query', unit: 'rows', value: server.readRowsMean, read: null },
        { metric: 'read_bytes_per_query', unit: 'B', value: server.readBytesMean, read: null },
        { metric: 'server_p50', unit: 'ms', value: server.p50Ms, read: null },
        { metric: 'server_mean', unit: 'ms', value: server.meanMs, read: null },
      );
    } finally {
      if (a.variant === 'ch_g256') await aux.command({ query: `DROP DATABASE IF EXISTS ${G256_DB} SYNC` });
    }
  }
  const d = dist(lat);
  const cpu = detail.cpuMeasured as NodeJS.CpuUsage;
  // 도구 CPU — 이 프로세스의 (user + system) / 측정 벽시계 / CPU 집합 크기(컨테이너 cpuset 11-12면 2) — 포화 창은 버린다(공정성 규칙 10)
  const cpus = availableParallelism();
  const toolCpu = wall > 0 ? (cpu.user + cpu.system) / 1000 / wall / cpus : null;
  detail.cpuTotal = process.cpuUsage(cpu0);
  detail.cpus = cpus;
  measures.unshift(
    { metric: 'latency_p50', unit: 'ms', value: d.p50, read: null, detail: d },
    { metric: 'latency_p95', unit: 'ms', value: d.p95, read: null },
    {
      metric: 'qps',
      unit: 'req/s',
      value: wall > 0 ? Math.round((a.queries / wall) * 1000 * 10) / 10 : null,
      read: null,
    },
    {
      metric: 'tool_cpu',
      unit: 'ratio',
      value: toolCpu === null ? null : Math.round(toolCpu * 1000) / 1000,
      read: null,
    },
  );
  return { measures, detail };
}
