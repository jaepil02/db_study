// S3 구조 판정 · 기록 쿼리 — EXP-29(regression-stage-s3) · EXP-31(rollup-consistency) · EXP-13 · 19 · 34의 정합 몫
// 실행: docker compose run --rm --no-deps api node dist/lab/s3-verify.js --phase stopped [--control] [--p95] [--window-start ISO --window-end ISO]
// 적재가 멈추고 api가 정상 종료(드레인)된 뒤에 돈다 — 재기동의 기동 복원이 rt:latest 대조를 가린다(S2 판정 유지).
// 판정 정본: 03_requirements/14 AC-01 · 02 · 05(§롤업 정합성 허용 오차 — avg 상계 2·γ(n)·S/n) · 07 · 21 · 10_observability/02 §E2E 지연 SQL.
// 결과는 JSON 한 줄 · 랙(lag + pending)이 0이 아니면 exit 1(반복 불성립).
import { createClient } from '@clickhouse/client';
import { DLQ_FIELDS, decodeEntry, STREAM_DLQ } from '@db-study/shared';
import Redis from 'ioredis';
import { Client } from 'pg';

const STREAM = 'stream:plc:raw';
const GROUP = 'grp:ingest';
const PAGE = 1000;
const U = 2 ** -53;

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}
const flag = (name: string) => process.argv.includes(name);

function chFromUrl(raw: string) {
  const u = new URL(raw);
  return createClient({
    url: `${u.protocol}//${u.host}`,
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, '') || 'plc',
    request_timeout: 120_000,
  });
}
type Ch = ReturnType<typeof chFromUrl>;

async function rows<T>(ch: Ch, query: string, query_params: Record<string, unknown> = {}): Promise<T[]> {
  const rs = await ch.query({ query, query_params, format: 'JSONEachRow' });
  return rs.json<T>();
}

/** γ(n) = n·u / (1 − n·u) — 합산 순서와 무관한 Float64 합 오차 상계의 계수 */
const gamma = (n: number) => (n * U) / (1 - n * U);

/** AC-05 — 해상도 하나의 버킷별 대조(count · min · max · last 정확 · avg 상계) */
async function rollupCheck(ch: Ch, table: 'tag_1m' | 'tag_1h' | 'tag_1d') {
  const bucketExpr = {
    tag_1m: 'toStartOfMinute(ts)',
    tag_1h: 'toStartOfHour(ts)',
    tag_1d: "toStartOfDay(ts, 'Asia/Seoul')",
  }[table];
  type Raw = { k: string; n: string; mn: number; mx: number; last: number; a: number; s: number };
  type Roll = { k: string; n: string; mn: number; mx: number; last: number; a: number };
  const raw = await rows<Raw>(
    ch,
    `SELECT concat(toString(toUnixTimestamp(${bucketExpr})), ':', toString(device_id), ':', toString(tag_id)) AS k,
            count() AS n, min(value) AS mn, max(value) AS mx, argMax(value, ts) AS last, avg(value) AS a, sum(abs(value)) AS s
       FROM plc.tag_raw GROUP BY k`,
  );
  const roll = await rows<Roll>(
    ch,
    `SELECT concat(toString(toUnixTimestamp(bucket)), ':', toString(device_id), ':', toString(tag_id)) AS k,
            countMerge(cnt) AS n, minMerge(min_v) AS mn, maxMerge(max_v) AS mx, argMaxMerge(last_v) AS last, avgMerge(avg_v) AS a
       FROM plc.${table} GROUP BY k`,
  );
  const r = new Map(roll.map((x) => [x.k, x]));
  let countMismatch = 0;
  let selectMismatch = 0;
  let avgOver = 0;
  let missing = 0;
  let maxAvgRatio = 0;
  const samples: unknown[] = [];
  for (const x of raw) {
    const y = r.get(x.k);
    if (!y) {
      missing++;
      continue;
    }
    const n = Number(x.n);
    if (n !== Number(y.n)) countMismatch++;
    if (x.mn !== y.mn || x.mx !== y.mx || x.last !== y.last) selectMismatch++;
    const bound = (2 * gamma(n) * Number(x.s)) / n;
    const diff = Math.abs(Number(x.a) - Number(y.a));
    if (bound > 0) maxAvgRatio = Math.max(maxAvgRatio, diff / bound);
    if (diff > bound) avgOver++;
    if ((n !== Number(y.n) || diff > bound) && samples.length < 3) samples.push({ raw: x, roll: y, bound });
  }
  return {
    buckets: raw.length,
    rollupBuckets: roll.length,
    missing,
    extra: roll.length - (raw.length - missing),
    countMismatch,
    selectMismatch,
    avgOverBound: avgOver,
    maxAvgDiffOverBound: maxAvgRatio,
    samples,
  };
}

async function main() {
  const phase = arg('--phase');
  if (phase !== 'stopped') throw new Error('--phase stopped');
  const redis = new Redis(process.env.REDIS_URL as string, { lazyConnect: true });
  await redis.connect();
  const ch = chFromUrl(process.env.CLICKHOUSE_URL as string);
  const pg = new Client({ connectionString: process.env.POSTGRES_URL });
  await pg.connect();
  const out: Record<string, unknown> = { script: 's3-verify', phase, at: new Date().toISOString() };
  let lagOk = true;
  try {
    const groups = (await redis.xinfo('GROUPS', STREAM)) as unknown[][];
    const g = groups
      .map((row) => {
        const o: Record<string, unknown> = {};
        for (let i = 0; i < row.length; i += 2) o[String(row[i])] = row[i + 1];
        return o;
      })
      .find((x) => x.name === GROUP);
    out.group = { lag: g?.lag ?? null, pending: g?.pending ?? null, consumers: g?.consumers ?? null };
    lagOk = Number(g?.lag ?? -1) === 0 && Number(g?.pending ?? -1) === 0;
    out.lagZero = lagOk;

    // ── AC-01 교차 확인 — Stream 전 엔트리 디코딩 포인트 합(해독 불가는 따로 센다) · DLQ 엔트리 수
    let start = '-';
    let entries = 0;
    let points = 0;
    let undecodable = 0;
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
          points += decodeEntry(fields[i + 1] as Buffer).tg.length;
        } catch {
          undecodable++;
        }
        start = `(${id.toString()}`;
      }
      if (page.length < PAGE) break;
    }
    const dlqLen = await redis.xlen(STREAM_DLQ).catch(() => 0);
    const dlqReasons: Record<string, number> = {};
    // 재시도 소진으로 격리된 원 엔트리의 포인트 — AC-12 "정상 엔트리 차 0"은 diff − 이 값으로 본다
    let dlqExhaustedPoints = 0;
    if (dlqLen > 0) {
      const dl = (await redis.callBuffer('XRANGE', STREAM_DLQ, '-', '+')) as [Buffer, Buffer[]][];
      for (const [, f] of dl) {
        const at = (k: string) => f[f.findIndex((x) => x.toString() === k) + 1];
        const r = at(DLQ_FIELDS.reason)?.toString() ?? 'unknown';
        dlqReasons[r] = (dlqReasons[r] ?? 0) + 1;
        if (r === 'retry_exhausted') {
          try {
            dlqExhaustedPoints += decodeEntry(at(DLQ_FIELDS.payload) as Buffer).tg.length;
          } catch {
            // 소진 격리분은 해독된 엔트리였다 — 여기서 실패하면 DLQ 사본이 손상된 것이라 diffAfterDlq가 드러낸다
          }
        }
      }
    }
    const [tr] = await rows<{ n: string }>(ch, 'SELECT count() AS n FROM plc.tag_raw');
    out.ac01 = {
      streamEntries: entries,
      streamPoints: points,
      undecodable,
      tagRawRows: Number(tr?.n ?? 0),
      diff: points - Number(tr?.n ?? 0),
      dlqEntries: dlqLen,
      dlqReasons,
      dlqExhaustedPoints,
      diffAfterDlq: points - Number(tr?.n ?? 0) - dlqExhaustedPoints,
    };

    // ── AC-02 — tag_id + ts 조합별 행 수 2 이상인 조합 수
    const [dup] = await rows<{ combos: string; extra: string }>(
      ch,
      `SELECT count() AS combos, sum(c - 1) AS extra
         FROM (SELECT tag_id, ts, count() AS c FROM plc.tag_raw GROUP BY tag_id, ts HAVING c > 1)`,
    );
    out.ac02 = { duplicateCombos: Number(dup?.combos ?? 0), extraRows: Number(dup?.extra ?? 0) };

    // ── AC-07 — 설비별 rt:latest 대 argMax 전 태그
    const devs = await pg.query('SELECT device_id FROM device ORDER BY device_id');
    const truth = new Map<string, [number, number, number]>();
    for (const r of await rows<{ device_id: number; tag_id: number; ts_ms: string; v: number; q: number }>(
      ch,
      `SELECT device_id, tag_id, toUnixTimestamp64Milli(max(ts)) AS ts_ms, argMax(value, ts) AS v, argMax(quality, ts) AS q
         FROM plc.tag_raw GROUP BY device_id, tag_id`,
    ))
      truth.set(`${r.device_id}:${r.tag_id}`, [Number(r.ts_ms), Number(r.v), Number(r.q)]);
    let compared = 0;
    let mismatched = 0;
    let missingInRedis = 0;
    for (const { device_id } of devs.rows) {
      const h = await redis.hgetall(`rt:latest:${device_id}`);
      for (const [key, t] of truth) {
        if (!key.startsWith(`${device_id}:`)) continue;
        const v = h[key.slice(key.indexOf(':') + 1)];
        if (v === undefined) {
          missingInRedis++;
          continue;
        }
        compared++;
        const [ts, value, q] = v.split(',').map(Number) as [number, number, number];
        if (ts !== t[0] || value !== t[1] || q !== t[2]) mismatched++;
      }
    }
    out.ac07 = { tags: truth.size, compared, mismatched, missingInRedis };

    // ── AC-05 — 세 해상도 버킷 대조
    out.ac05 = {
      tag_1m: await rollupCheck(ch, 'tag_1m'),
      tag_1h: await rollupCheck(ch, 'tag_1h'),
      tag_1d: await rollupCheck(ch, 'tag_1d'),
    };

    // ── EXP-31 — 롤업 p95의 원시 안 순위 − 0.95(1분 버킷 · 판정 아님 · 분포 기록)
    if (flag('--p95')) {
      const [d] = await rows<{ n: string; mn: number; q50: number; mx: number; within01: string }>(
        ch,
        `WITH r AS (
           SELECT bucket, device_id, tag_id, quantilesTDigestMerge(0.95)(p95_v)[1] AS p95
             FROM plc.tag_1m GROUP BY bucket, device_id, tag_id),
         raw AS (
           SELECT toStartOfMinute(ts) AS bucket, device_id, tag_id, groupArray(value) AS vs
             FROM plc.tag_raw GROUP BY bucket, device_id, tag_id)
         SELECT count() AS n, min(e) AS mn, quantileExact(0.5)(e) AS q50, max(e) AS mx, countIf(abs(e) <= 0.01) AS within01
           FROM (SELECT arrayCount(x -> x <= r.p95, raw.vs) / length(raw.vs) - 0.95 AS e
                   FROM r INNER JOIN raw USING (bucket, device_id, tag_id))`,
      );
      out.exp31 = {
        buckets: Number(d?.n ?? 0),
        rankErrorMin: d?.mn,
        rankErrorMedian: d?.q50,
        rankErrorMax: d?.mx,
        withinOnePct: Number(d?.within01 ?? 0),
      };
    }

    // ── AC-21 — KST 일별 count(tag_raw) = count(plc_tag_raw_control)
    if (flag('--control')) {
      const chDays = await rows<{ d: string; n: string }>(
        ch,
        `SELECT toString(toDate(ts, 'Asia/Seoul')) AS d, count() AS n FROM plc.tag_raw GROUP BY d ORDER BY d`,
      );
      const pgDays = await pg.query<{ d: string; n: string }>(
        `SELECT to_char((ts AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS d, count(*)::text AS n
           FROM plc_tag_raw_control GROUP BY 1 ORDER BY 1`,
      );
      const pgMap = new Map(pgDays.rows.map((r) => [r.d, Number(r.n)]));
      const days = chDays.map((r) => ({ day: r.d, tagRaw: Number(r.n), control: pgMap.get(r.d) ?? 0 }));
      out.ac21 = { days, diff: days.reduce((a, x) => a + (x.tagRaw - x.control), 0) };
    }

    // ── E2E 기록 SQL(판정 창 고정 quantilesExact)
    const ws = arg('--window-start');
    const we = arg('--window-end');
    if (ws && we) {
      const [r] = await rows<{ q: number[]; n: string }>(
        ch,
        `SELECT quantilesExact(0.50, 0.95, 0.99)(dateDiff('millisecond', ts, ingested_at)) AS q, count() AS n
           FROM plc.tag_raw
          WHERE ts >= fromUnixTimestamp64Milli({s:Int64}) AND ts < fromUnixTimestamp64Milli({e:Int64})`,
        { s: Date.parse(ws), e: Date.parse(we) },
      );
      out.e2e = {
        window: { start: ws, end: we },
        p50Ms: r?.q[0],
        p95Ms: r?.q[1],
        p99Ms: r?.q[2],
        rows: Number(r?.n ?? 0),
      };
    }
  } finally {
    redis.disconnect();
    await ch.close();
    await pg.end();
  }
  process.stdout.write(`${JSON.stringify(out)}\n`);
  if (!lagOk) {
    process.stderr.write('랙이 0이 아니다 — 반복 불성립\n');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
