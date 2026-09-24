// S2 구조 판정 · 기록 쿼리 — EXP-29(AC-01 · 04 · 07) · EXP-30(E2E quantilesExact) 한 번의 반복분
// 실행: docker compose run --rm --no-deps api node dist/lab/s2-verify.js --phase running | stopped [--window-start ISO --window-end ISO]
// running: api가 떠 있을 때 AC-04(API 응답 시각) / stopped: api를 정상 종료(드레인)한 뒤 AC-01 · 07 · E2E.
// stopped는 api를 다시 띄우지 않는다 — 재기동의 기동 복원(argMax → rt:latest)이 AC-07 대조를 복원값끼리의 비교로 만든다.
// 랙(lag + pending)이 0이 아니면 exit 1 — 수집 중 대조는 판정하지 않는다(AC-01 · 07).
// 접속 정보는 컨테이너 환경변수(REDIS_URL · CLICKHOUSE_URL · POSTGRES_URL)에서 읽는다. 결과는 JSON 한 줄.
import { createClient } from '@clickhouse/client';
import { decodeEntry } from '@db-study/shared';
import Redis from 'ioredis';
import { Client } from 'pg';

const STREAM = 'stream:plc:raw';
const GROUP = 'grp:ingest';
const PAGE = 1000;
const API = 'http://api:3000';

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function chFromUrl(raw: string) {
  const u = new URL(raw);
  return createClient({
    url: `${u.protocol}//${u.host}`,
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'plc',
  });
}

async function ac04(ch: ReturnType<typeof chFromUrl>, out: Record<string, unknown>) {
  // ── AC-04: 알려진 epoch 행(최신 행 하나) → 시계열 API · 최신값 API의 ts가 같은 순간인가
  const known = await ch.query({
    query: `SELECT device_id, tag_id, toUnixTimestamp64Milli(ts) AS ts_ms, toString(ts) AS ts_kst
              FROM plc.tag_raw ORDER BY ts DESC LIMIT 1`,
    format: 'JSONEachRow',
  });
  const k = (await known.json<{ device_id: number; tag_id: number; ts_ms: string; ts_kst: string }>())[0];
  if (k) {
    const tsMs = Number(k.ts_ms);
    const body = {
      tagIds: [Number(k.tag_id)],
      from: new Date(tsMs - 1000).toISOString(),
      to: new Date(tsMs + 1).toISOString(),
    };
    const tsq = await fetch(`${API}/api/v1/timeseries/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json() as Promise<{ series: { points: number[][] }[] }>);
    const apiTs = tsq.series?.[0]?.points.find((p) => p[0] === tsMs)?.[0] ?? null;
    const latest = await fetch(`${API}/api/v1/realtime/devices/${k.device_id}/tags`).then(
      (r) => r.json() as Promise<{ items: { tagId: number; ts: number }[] }>,
    );
    const latestTs = latest.items?.find((i) => i.tagId === Number(k.tag_id))?.ts ?? null;
    out.ac04 = {
      clickhouseEpochMs: tsMs,
      clickhouseKst: k.ts_kst,
      timeseriesTs: apiTs,
      latestTs,
      timeseriesDiffMs: apiTs === null ? null : apiTs - tsMs,
      latestDiffMs: latestTs === null ? null : latestTs - tsMs,
    };
  }
}

async function main() {
  const redis = new Redis(process.env.REDIS_URL as string, { lazyConnect: true });
  await redis.connect();
  const ch = chFromUrl(process.env.CLICKHOUSE_URL as string);
  const pg = new Client({ connectionString: process.env.POSTGRES_URL });
  await pg.connect();
  const phase = arg('--phase');
  if (phase !== 'running' && phase !== 'stopped') throw new Error('--phase running | stopped');
  const out: Record<string, unknown> = { script: 's2-verify', phase, at: new Date().toISOString() };
  let lagOk = true;
  try {
    // ── 랙 0 확인 — 그룹 lag · pending
    const groups = (await redis.xinfo('GROUPS', STREAM)) as unknown[][];
    const g = groups.map((row) => {
      const o: Record<string, unknown> = {};
      for (let i = 0; i < row.length; i += 2) o[String(row[i])] = row[i + 1];
      return o;
    });
    const ing = g.find((x) => x.name === GROUP);
    out.group = { lag: ing?.lag ?? null, pending: ing?.pending ?? null };
    lagOk = Number(ing?.lag ?? -1) === 0 && Number(ing?.pending ?? -1) === 0;
    out.lagZero = lagOk;
    if (phase === 'running') {
      await ac04(ch, out);
      process.stdout.write(`${JSON.stringify(out)}\n`);
      return;
    }

    // ── AC-01 분모: Stream 엔트리 전부를 디코딩해 포인트 합(모드 A — 폴링 표본이 행이 된다)
    let start = '-';
    let entries = 0;
    let points = 0;
    let undecodable = 0;
    const perDevice = new Map<number, number>();
    for (;;) {
      const page = (await redis.callBuffer('XRANGE', STREAM, start, '+', 'COUNT', PAGE)) as [
        Buffer,
        Buffer[],
      ][];
      if (page.length === 0) break;
      for (const [id, fields] of page) {
        entries++;
        const i = fields.findIndex((f) => f.toString() === 'p');
        try {
          const e = decodeEntry(fields[i + 1] as Buffer);
          points += e.tg.length;
          perDevice.set(e.d, (perDevice.get(e.d) ?? 0) + e.tg.length);
        } catch {
          undecodable++;
        }
        start = `(${id.toString()}`;
      }
      if (page.length < PAGE) break;
    }
    const xlen = await redis.xlen(STREAM);
    const rawCount = await ch.query({
      query: 'SELECT device_id, count() AS n FROM plc.tag_raw GROUP BY device_id ORDER BY device_id',
      format: 'JSONEachRow',
    });
    const chRows = await rawCount.json<{ device_id: number; n: string }>();
    const chTotal = chRows.reduce((a, r) => a + Number(r.n), 0);
    out.ac01 = {
      streamEntries: entries,
      xlen,
      undecodable,
      streamPoints: points,
      tagRawRows: chTotal,
      diff: points - chTotal,
      perDevice: [...perDevice].map(([d, n]) => ({
        device: d,
        streamPoints: n,
        tagRawRows: Number(chRows.find((r) => Number(r.device_id) === d)?.n ?? 0),
      })),
    };

    // ── AC-07: 설비별 rt:latest 대 argMax(value, ts) · max(ts) · argMax(quality, ts) — 창 없이 전 기간
    const devs = await pg.query('SELECT device_id FROM device ORDER BY device_id');
    const am = await ch.query({
      query: `SELECT device_id, tag_id, toUnixTimestamp64Milli(max(ts)) AS ts_ms,
                     argMax(value, ts) AS last_value, argMax(quality, ts) AS last_quality
                FROM plc.tag_raw GROUP BY device_id, tag_id`,
      format: 'JSONEachRow',
    });
    const truth = new Map<string, [number, number, number]>();
    for (const r of await am.json<{
      device_id: number;
      tag_id: number;
      ts_ms: string;
      last_value: number;
      last_quality: number;
    }>())
      truth.set(`${r.device_id}:${r.tag_id}`, [
        Number(r.ts_ms),
        Number(r.last_value),
        Number(r.last_quality),
      ]);
    let compared = 0;
    let mismatched = 0;
    let missingInRedis = 0;
    const samples: unknown[] = [];
    for (const { device_id } of devs.rows) {
      const h = await redis.hgetall(`rt:latest:${device_id}`);
      for (const [key, t] of truth) {
        if (!key.startsWith(`${device_id}:`)) continue;
        const tag = key.slice(key.indexOf(':') + 1);
        const v = h[tag];
        if (v === undefined) {
          missingInRedis++;
          continue;
        }
        compared++;
        const [ts, value, q] = v.split(',').map(Number) as [number, number, number];
        if (ts !== t[0] || value !== t[1] || q !== t[2]) {
          mismatched++;
          if (samples.length < 5) samples.push({ device: device_id, tag, redis: v, clickhouse: t });
        }
      }
    }
    out.ac07 = { tags: truth.size, compared, mismatched, missingInRedis, samples };

    // ── EXP-30 기록 SQL — 판정 창 고정 quantilesExact(10_observability/02 §E2E 지연 SQL)
    const ws = arg('--window-start');
    const we = arg('--window-end');
    if (ws && we) {
      const e2e = await ch.query({
        query: `SELECT quantilesExact(0.50, 0.95, 0.99)(dateDiff('millisecond', ts, ingested_at)) AS q_ms,
                       count() AS rows, toUnixTimestamp64Milli(min(ts)) AS first_ts, toUnixTimestamp64Milli(max(ts)) AS last_ts
                  FROM plc.tag_raw
                 WHERE ts >= fromUnixTimestamp64Milli({s:Int64}) AND ts < fromUnixTimestamp64Milli({e:Int64})`,
        query_params: { s: Date.parse(ws), e: Date.parse(we) },
        format: 'JSONEachRow',
      });
      const r = (await e2e.json<{ q_ms: number[]; rows: string; first_ts: string; last_ts: string }>())[0];
      out.e2e = {
        window: { start: ws, end: we },
        p50Ms: r?.q_ms[0],
        p95Ms: r?.q_ms[1],
        p99Ms: r?.q_ms[2],
        rows: Number(r?.rows ?? 0),
      };
    }
  } finally {
    redis.disconnect();
    await ch.close();
    await pg.end();
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
  if (phase === 'stopped' && !lagOk) {
    process.stderr.write('랙이 0이 아니다 — 수집 중 대조는 판정하지 않는다(반복 불성립)\n');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
