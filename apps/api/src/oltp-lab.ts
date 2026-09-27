// 역방향 대조 실행기 진입점(EXP-40~44 · S5) — Nest 없이 돈다(mode-d.ts와 같은 모양 · dist/oltp-lab.js)
// 설계 정본 docs/05_data_stores/10_olap_vs_rdb_control.md §역방향 대조 — 업무 워크로드 · DDL 03_clickhouse_schema §업무 대조 테이블
// 사용(도구 컨테이너 11-12 · 앱 비경유 — 오케스트레이터 scripts/lab/s5/oltp/oltp.sh가 run --rm --no-deps로 부른다):
//   node dist/oltp-lab.js probe                               판별 대상 4(plc 밖 탐침 DB에서 · 끝에 지운다) + 서버 버전 · 설정
//   node dist/oltp-lab.js fill --scale 10000 [--seed 42] [--in-progress 0.5] [--stores both|clickhouse]
//   node dist/oltp-lab.js verify --scale 10000 [--seed 42] [--in-progress 0.5]   채움 대조(쓰지 않는다 · 러너 adopt — 복원 스냅샷 = 지금 행 벡터?)
//   node dist/oltp-lab.js settle [--max-sec 120] [--interval-sec 2]          ClickHouse 대조 테이블 머지 수렴 대기
//   node dist/oltp-lab.js exp40 --variant pg|ch_alter_async|ch_alter_sync|ch_lwu|ch_rmt --scale N --rep 0..2 [--n 100]
//        [--poll-interval-ms 5] [--poll-max 2000] [--converge both|skip] [--settle-max-sec 120] [--r2-repeat 5] [--read-warmup 1] [--budget-sec 510]
//   node dist/oltp-lab.js exp41 --variant pg|ch_g8192|ch_g256 --scale N --rep r --concurrency 1|8|32 [--queries 2000] [--warmup 2000]
//   node dist/oltp-lab.js exp42 --variant pg|ch_lwu --scale N --rep r [--inject 20] [--pairs 20]
//   node dist/oltp-lab.js exp43 --variant pg|ch_mt|ch_rmt --scale N --rep r [--k 8] [--converge both|skip] [--final-repeat 10]
//   node dist/oltp-lab.js exp44 --variant pg|pg_sync_on|ch_sync|ch_async --scale N --rep r --rate 50|200|500 [--duration 60] [--concurrency 16]
//   스모크(plc · 업무 테이블 밖): --ch-db lab_scratch_x --pg-schema lab_scratch_x (둘 다 · 규모 100~)
// 접속: CLICKHOUSE_URL(8123) · POSTGRES_URL(app_rw) — 비밀은 환경변수에서만.
// 출력: JSON 한 줄 = 한 측정(kind measure) + 마지막 한 줄 kind detail(원시 요약 · 조건). 종료 코드 0 성공 · 1 실패.
import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import { loadConfig, requireStoreUrl, runInfo } from './config/app-config';
import { runExp42 } from './modules/datagen/oltp-lab/oltp-atomic';
import { runExp43 } from './modules/datagen/oltp-lab/oltp-constraint';
import { type Ctx, EXP_ID, EXP_OP, type RunResult, storeOf } from './modules/datagen/oltp-lab/oltp-context';
import { chConditions, chSettle, fill, pgLineIds, probe } from './modules/datagen/oltp-lab/oltp-fill';
import { runExp44 } from './modules/datagen/oltp-lab/oltp-insert';
import {
  connPlan,
  type OltpArgs,
  parseOltpArgs,
  type RunArgs,
} from './modules/datagen/oltp-lab/oltp-options';
import { runExp41 } from './modules/datagen/oltp-lab/oltp-point';
import { oltpChClient, oltpPgClient, oltpPgPool } from './modules/datagen/oltp-lab/oltp-stores';
import { runExp40 } from './modules/datagen/oltp-lab/oltp-update';
import { verifyFill } from './modules/datagen/oltp-lab/oltp-verify';

const RUNNERS: Record<RunArgs['action'], (ctx: Ctx) => Promise<RunResult>> = {
  exp40: runExp40,
  exp41: runExp41,
  exp42: runExp42,
  exp43: runExp43,
  exp44: runExp44,
};

function line(o: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...o })}\n`);
}

async function pgSettings(pg: { query: (q: string) => Promise<{ rows: unknown[] }> }) {
  return (
    await pg.query(
      `SELECT name, setting FROM pg_settings WHERE name IN ('server_version', 'synchronous_commit', 'shared_buffers', 'max_connections',
         'autovacuum', 'autovacuum_naptime', 'wal_level', 'fsync', 'full_page_writes', 'jit', 'search_path') ORDER BY name`,
    )
  ).rows;
}

async function runExp(a: RunArgs, info: Record<string, unknown>, chUrl: string, pgUrl: string) {
  const store = storeOf(a.variant);
  // 두 저장소 같은 커넥션 수(공정성 규칙 1) — 41 · 44 --concurrency · 43 K · 나머지 순차 고정 풀(connPlan)
  const plan = connPlan(a);
  const syncCommit = a.variant === 'pg_sync_on' ? 'on' : 'off';
  const pg = oltpPgPool({ url: pgUrl, schema: a.pgSchema, synchronousCommit: syncCommit, max: plan.pgMax });
  const pgAux = oltpPgPool({ url: pgUrl, schema: a.pgSchema, synchronousCommit: 'off', max: plan.pgAuxMax });
  const ch =
    store === 'clickhouse'
      ? oltpChClient({ url: chUrl, database: a.chDb, maxConnections: plan.chMax })
      : null;
  const chAux =
    store === 'clickhouse'
      ? oltpChClient({ url: chUrl, database: a.chDb, maxConnections: plan.chAuxMax })
      : null;
  try {
    const lineIds = await pgLineIds(pgAux);
    const ctx: Ctx = {
      args: a,
      store,
      runId: randomBytes(4).toString('hex'),
      ch,
      chAux,
      pg: store === 'postgresql' || a.action === 'exp42' ? pg : null,
      pgAux,
      pgUrl,
      lineIds,
    };
    const conditions =
      store === 'clickhouse' && chAux ? await chConditions(chAux, a.chDb) : { pg: await pgSettings(pgAux) };
    const r = await RUNNERS[a.action](ctx);
    const head = {
      exp: EXP_ID[a.action],
      op: EXP_OP[a.action],
      store,
      variant: a.variant,
      scale: a.scale,
      concurrency:
        a.action === 'exp41' || a.action === 'exp44' ? a.concurrency : a.action === 'exp42' ? 2 : 1,
      rate: a.rate,
      rep: a.rep,
      runId: ctx.runId,
    };
    for (const m of r.measures) line({ kind: 'measure', ...head, ...m });
    line({ kind: 'detail', ...head, args: a, connections: plan, conditions, ...info, detail: r.detail });
  } finally {
    await pg.end();
    await pgAux.end();
    await ch?.close();
    await chAux?.close();
  }
}

async function main() {
  const cfg = loadConfig();
  const a: OltpArgs = parseOltpArgs(process.argv);
  for (const w of cfg.switchWarnings) process.stderr.write(`경고: ${w}\n`);
  const chUrl = requireStoreUrl(cfg, 'clickhouseUrl');
  const pgUrl = requireStoreUrl(cfg, 'postgresUrl');
  // 역방향은 용량 티어 축 밖이다(업무 규모 단계가 축) — 판독기 계약(문자열)에 맞춰 "해당 없음"(역방향 측정 조건 4요소 행)
  const base = runInfo(cfg);
  const info = { ...base, run: { ...base.run, capacityTier: '해당 없음' } };
  if (a.action === 'probe' || a.action === 'settle') {
    const ch = oltpChClient({ url: chUrl, database: a.chDb, maxConnections: 2 });
    try {
      if (a.action === 'probe') {
        const pg = await oltpPgClient({ url: pgUrl, schema: a.pgSchema, synchronousCommit: 'off' });
        try {
          line({
            kind: 'probe',
            probe: await probe(ch),
            conditions: { ch: await chConditions(ch, a.chDb), pg: await pgSettings(pg) },
            ...info,
          });
        } finally {
          await pg.end();
        }
      } else line({ kind: 'settle', db: a.chDb, ...(await chSettle(ch, a.chDb, a.maxSec, a.intervalSec)) });
    } finally {
      await ch.close();
    }
    return;
  }
  if (a.action === 'verify') {
    const ch = oltpChClient({ url: chUrl, database: a.chDb, maxConnections: 2 });
    const pg = await oltpPgClient({ url: pgUrl, schema: a.pgSchema, synchronousCommit: 'off' });
    try {
      const r = await verifyFill(a, pg, ch);
      line({ kind: 'verify', scale: a.scale, seed: a.seed, inProgress: a.inProgress, ...r, ...info });
      if (!r.match) process.exitCode = 2;
    } finally {
      await pg.end();
      await ch.close();
    }
    return;
  }
  if (a.action === 'fill') {
    const ch = oltpChClient({ url: chUrl, database: a.chDb, maxConnections: 2 });
    const pg = await oltpPgClient({ url: pgUrl, schema: a.pgSchema, synchronousCommit: 'off' });
    try {
      const t = Date.now();
      const r = await fill(a, pg, ch);
      line({
        kind: 'fill',
        scale: a.scale,
        seed: a.seed,
        inProgress: a.inProgress,
        stores: a.stores,
        wallMs: Date.now() - t,
        ...r,
        ...info,
      });
      if (!r.match) process.exitCode = 2;
    } finally {
      await pg.end();
      await ch.close();
    }
    return;
  }
  await runExp(a, info, chUrl, pgUrl);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
