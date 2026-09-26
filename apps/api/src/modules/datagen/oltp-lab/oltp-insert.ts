// EXP-44 단건 고빈도 삽입 — 열린 고리 요청률(rate req/s × duration 초) · 요청마다 1행 INSERT · 동시 요청 상한(넘치면 누락)
// 변형: pg(synchronous_commit off) · pg_sync_on(보조 on 팔) · ch_sync(동기 INSERT) · ch_async(async_insert 1 · wait_for_async_insert 1)
// 지표 — 삽입 지연 p50 · p95 · 달성률 · 예정 대비 지연(lag) · 활성 파트 추이(1초 표본) · 머지 쓰기 바이트 · DelayedInserts · RejectedInserts
//        · WAL 바이트 · autovacuum 실행 수. async_insert 서버 기본 0은 그대로 두고 쿼리 설정으로만 켠다(05_data_stores/10 §ClickHouse 변형의 설정).
import type { ClickHouseClient } from '@clickhouse/client';
import type { Pool } from 'pg';
import { PG_LOG_INSERT_SQL } from './oltp-atomic';
import { type Ctx, chTable, logComment, type Measure, type RunResult } from './oltp-context';
import { dist } from './oltp-stats';
import {
  chNow,
  chPhys,
  chScalar,
  chServerTime,
  chWarm,
  eventDelta,
  KEEP_ALIVE_DETAIL,
  now,
  PG_STATS_SETTLE_MS,
  pgPhys,
  pgPhysDelta,
  pgStmtMean,
  pgStmtStat,
  pgWarmPool,
  sleep,
} from './oltp-stores';

/** ClickHouse log_id 대역 — EXP-44(요청률 · 반복마다 겹치지 않게) */
export const LOG_ID_BASE_44 = 44_000_000_000;

export interface OpenLoopResult {
  scheduled: number;
  sent: number;
  ok: number;
  errors: number;
  dropped: number;
  /** errors 중 ClickHouse 동시 쿼리 상한 거절(코드 202) — 두 저장소 같은 칸 · PostgreSQL은 해당 없음 0(N5) */
  rejectedTooMany: number;
  latency: number[];
  lag: number[];
  wallMs: number;
  errorSample: string[];
}

/** ClickHouse 오류 코드 202 TOO_MANY_SIMULTANEOUS_QUERIES — 코드(ClickHouseError.code) 또는 메시지로 가린다 */
export function isTooManySimultaneous(e: unknown): boolean {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === '202' || code === 202) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /TOO_MANY_SIMULTANEOUS_QUERIES|Too many simultaneous queries/i.test(msg);
}

/** 열린 고리 — k번째 요청 예정 시각 t0 + k·1000/rate · 동시 요청이 상한이면 보내지 않고 누락으로 센다 */
export async function openLoop(
  rate: number,
  durationSec: number,
  maxInflight: number,
  send: (k: number) => Promise<void>,
): Promise<OpenLoopResult> {
  const total = Math.round(rate * durationSec);
  const r: OpenLoopResult = {
    scheduled: total,
    sent: 0,
    ok: 0,
    errors: 0,
    dropped: 0,
    rejectedTooMany: 0,
    latency: [],
    lag: [],
    wallMs: 0,
    errorSample: [],
  };
  const inflight = new Set<Promise<void>>();
  const t0 = now();
  for (let k = 0; k < total; k++) {
    const due = t0 + (k * 1000) / rate;
    const wait = due - now();
    if (wait > 1) await sleep(wait);
    if (inflight.size >= maxInflight) {
      r.dropped++;
      continue;
    }
    const start = now();
    r.lag.push(start - due);
    r.sent++;
    const p: Promise<void> = send(k)
      .then(() => {
        r.ok++;
        r.latency.push(now() - start);
      })
      .catch((e: unknown) => {
        r.errors++;
        if (isTooManySimultaneous(e)) r.rejectedTooMany++;
        if (r.errorSample.length < 5)
          r.errorSample.push((e instanceof Error ? e.message : String(e)).slice(0, 200));
      })
      .finally(() => inflight.delete(p));
    inflight.add(p);
  }
  await Promise.all(inflight);
  r.wallMs = now() - t0;
  return r;
}

async function partsSampler(
  aux: ClickHouseClient,
  db: string,
  trace: number[],
): Promise<() => Promise<void>> {
  let stop = false;
  const loop = (async () => {
    while (!stop) {
      trace.push(
        Number(
          await chScalar(
            aux,
            "SELECT count() AS n FROM system.parts WHERE database = {d:String} AND table = 'production_log_control' AND active",
            { d: db },
          ),
        ),
      );
      await sleep(1000);
    }
  })();
  return async () => {
    stop = true;
    await loop;
  };
}

export async function runExp44(ctx: Ctx): Promise<RunResult> {
  const a = ctx.args;
  const rate = a.rate as number;
  const measures: Measure[] = [];
  const detail: Record<string, unknown> = {
    rate,
    durationSec: a.durationSec,
    // 두 저장소 같은 값(공정성 규칙 1 · W1 검수 판정) — 커넥션 수 = --concurrency(PostgreSQL 풀 · ClickHouse max_open_connections) · 동시 요청 상한 = --inflight
    maxInflight: a.inflight,
    connections: a.concurrency,
    // 두 저장소 모두 커넥션 수만큼 미리 연다(L2) — 첫 요청들의 접속 비용이 지연 분포 · 풀 대기에 섞이지 않게
    warmConnections: a.concurrency,
    keepAlive: KEEP_ALIVE_DETAIL,
  };
  const orderOf = (k: number) => (k % a.scale) + 1;
  const recordedAt = Date.now();
  let res: OpenLoopResult;
  if (ctx.store === 'postgresql') {
    const pool = ctx.pg as Pool;
    const aux = ctx.pgAux as Pool;
    const phys0 = await pgPhys(aux, 'production_log');
    const st0 = await pgStmtStat(aux, PG_LOG_INSERT_SQL);
    const at = new Date(recordedAt).toISOString();
    await pgWarmPool(pool, a.concurrency);
    res = await openLoop(rate, a.durationSec, a.inflight, async (k) => {
      await pool.query(PG_LOG_INSERT_SQL, [orderOf(k), at, 10, 0]);
    });
    await sleep(PG_STATS_SETTLE_MS);
    const phys1 = await pgPhys(aux, 'production_log');
    const st1 = await pgStmtStat(aux, PG_LOG_INSERT_SQL);
    const d = pgPhysDelta(phys0, phys1);
    detail.phys = { before: phys0, after: phys1, delta: d };
    detail.server = pgStmtMean(st0, st1);
    measures.push(
      { metric: 'wal_bytes_per_insert', unit: 'B', value: res.ok ? d.walBytes / res.ok : null, read: null },
      { metric: 'autovacuum_runs', unit: 'count', value: d.autovacuumCount, read: null },
      { metric: 'server_insert_mean', unit: 'ms', value: pgStmtMean(st0, st1).meanMs, read: null },
    );
  } else {
    const ch = ctx.ch as ClickHouseClient;
    const aux = ctx.chAux as ClickHouseClient;
    const table = chTable(a.chDb, 'production_log_control');
    const async = a.variant === 'ch_async';
    const settings = {
      log_comment: logComment(ctx, 'insert'),
      ...(async ? { async_insert: 1 as const, wait_for_async_insert: 1 as const } : {}),
    };
    const t0 = await chNow(aux);
    const phys0 = await chPhys(aux, a.chDb, 'production_log_control', t0);
    const trace: number[] = [];
    const stopSampler = await partsSampler(aux, a.chDb, trace);
    const idBase = LOG_ID_BASE_44 + (rate * 10 + a.rep) * 10_000_000;
    try {
      // 측정 고리 바로 앞에서 커넥션 수만큼 연다(L2 · N3) — 앞 계기 조회 동안 유휴로 닫히지 않게
      await chWarm(ch, a.concurrency);
      res = await openLoop(rate, a.durationSec, a.inflight, async (k) => {
        await ch.insert({
          table,
          values: [
            {
              log_id: idBase + k,
              order_id: orderOf(k),
              recorded_at: recordedAt,
              good_qty: 10,
              defect_qty: 0,
            },
          ],
          format: 'JSONEachRow',
          clickhouse_settings: settings,
        });
      });
    } finally {
      await stopSampler();
    }
    const phys1 = await chPhys(aux, a.chDb, 'production_log_control', t0);
    const server = await chServerTime(aux, settings.log_comment, t0);
    const ev = eventDelta(phys0, phys1);
    const pl = (e: string) => phys1.partLog[e] ?? { n: 0, bytes: 0, uncompressed: 0, rows: 0 };
    detail.phys = { before: phys0, after: phys1, events: ev };
    detail.server = server;
    detail.partsTrace = trace;
    measures.push(
      { metric: 'new_parts', unit: 'count', value: pl('NewPart').n, read: null },
      { metric: 'merge_bytes', unit: 'B', value: pl('MergeParts').bytes, read: null },
      {
        metric: 'active_parts_max',
        unit: 'count',
        value: trace.length ? Math.max(...trace) : null,
        read: null,
      },
      { metric: 'active_parts_end', unit: 'count', value: phys1.activeParts, read: null },
      { metric: 'delayed_inserts', unit: 'count', value: ev.DelayedInserts ?? 0, read: null },
      { metric: 'rejected_inserts', unit: 'count', value: ev.RejectedInserts ?? 0, read: null },
      { metric: 'server_insert_mean', unit: 'ms', value: server.meanMs, read: null },
    );
  }
  const d = dist(res.latency);
  const lag = dist(res.lag);
  detail.loop = { ...res, latency: undefined, lag: undefined, latencyDist: d, lagDist: lag };
  measures.unshift(
    { metric: 'insert_latency_p50', unit: 'ms', value: d.p50, read: null, detail: d },
    { metric: 'insert_latency_p95', unit: 'ms', value: d.p95, read: null },
    {
      metric: 'achieved_rate',
      unit: 'req/s',
      value: Math.round((res.ok / (res.wallMs / 1000)) * 10) / 10,
      read: null,
    },
    {
      metric: 'achieved_ratio',
      unit: 'ratio',
      value: Math.round((res.ok / res.scheduled) * 10000) / 10000,
      read: null,
    },
    { metric: 'dropped', unit: 'count', value: res.dropped, read: null },
    { metric: 'errors', unit: 'count', value: res.errors, read: null },
    { metric: 'lag_p95', unit: 'ms', value: lag.p95, read: null },
  );
  return { measures, detail };
}
