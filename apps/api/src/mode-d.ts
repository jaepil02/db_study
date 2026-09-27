// 모드 D 단독 실행 진입점(GEN-08 백필 + GEN-10 대조군 동일 행 · S5) — Nest 없이 돈다(mode-b.ts와 같은 모양 · dist/mode-d.js).
// 사용: MEMORY_PROFILE=load WORKER_POOL_SIZE=2 node dist/mode-d.js --tier M --mix mixed --seed 42 --from <ISO> --to <ISO>
//         [--control on|off] [--profile <신호 프로파일 — 전 태그>] [--rollup on|off] [--devices N] [--tags-per-device N]
//       node dist/mode-d.js --prune-control        대조군 정리(tag_raw에 실제로 남은 UTC 일 밖의 대조군 일 파티션 DETACH · DROP)
// 접속: CLICKHOUSE_URL(8123) · POSTGRES_URL(app_rw — 태그 읽기 · COPY) · APP_OWNER_PASSWORD(과거 일 파티션 생성 · ⑧ 비우기 · 정리)
// 출력은 JSON 한 줄 — run · switches는 설정 로더가 만든다(측정 기록 4요소). 종료 코드 0 전부 일치 · 2 불일치 일 있음 · 1 실패.
// 한 번에 한 모드(REQ-GEN-05) — ② 주입 정지 확인이 최근 30초 실시간 적재 흔적을 보고 거부한다.
import 'reflect-metadata';
import { resolve } from 'node:path';
import { CAPACITY_TIERS } from '@db-study/shared';
import { Client } from 'pg';
import Piscina from 'piscina';
import { ConfigRejectedError, loadConfig, requireStoreUrl, runInfo } from './config/app-config';
import { assertTierShape, groupTags, MODE_B_TAG_SELECT } from './modules/datagen/mode-b/mode-b-options';
import type { EncodeResult, EncodeTask } from './modules/datagen/mode-d/mode-d-encode';
import {
  assertInRetention,
  type ModeDRunArgs,
  parseModeDArgs,
  periodMsOf,
} from './modules/datagen/mode-d/mode-d-options';
import {
  DEFAULT_TUNING,
  type EncodePool,
  ModeDRunner,
  type ModeDTags,
  modeDOutput,
} from './modules/datagen/mode-d/mode-d-runner';
import {
  ClickHouseRawStore,
  chClient,
  ownerUrl,
  PostgresControlStore,
} from './modules/datagen/mode-d/mode-d-stores';
import { profileFor } from './modules/datagen/signal/assignment';

/** 태그 집합 = 티어 시드와 같은 (device_id · tag_id) — tag_master에서 읽고 티어 모양과 대조한 뒤 부분 집합을 고른다 */
async function loadTags(postgresUrl: string, a: ModeDRunArgs): Promise<ModeDTags> {
  const pg = new Client({ connectionString: postgresUrl });
  await pg.connect();
  let devices: ReturnType<typeof groupTags>;
  try {
    devices = groupTags((await pg.query(MODE_B_TAG_SELECT, [true])).rows);
  } finally {
    await pg.end();
  }
  assertTierShape(devices, a.tier);
  const picked = devices
    .slice(0, a.devices ?? devices.length)
    .map((d) => ({ deviceId: d.deviceId, tagIds: d.tagIds.slice(0, a.tagsPerDevice ?? d.tagIds.length) }));
  const deviceIds: number[] = [];
  const tagIds: number[] = [];
  for (const d of picked)
    for (const t of d.tagIds) {
      deviceIds.push(d.deviceId);
      tagIds.push(t);
    }
  return {
    deviceIds: Uint32Array.from(deviceIds),
    tagIds: Uint32Array.from(tagIds),
    profiles: Uint8Array.from(tagIds, (t) => profileFor(a.mix, a.seed, t)),
  };
}

function poolOf(p: Piscina): EncodePool {
  return {
    run: (task: EncodeTask) =>
      p.run(task, {
        transferList: task.state ? [task.state.buffer as ArrayBuffer] : [],
      }) as Promise<EncodeResult>,
  };
}

async function main() {
  const cfg = loadConfig();
  const args = parseModeDArgs(process.argv);
  for (const w of cfg.switchWarnings) process.stderr.write(`경고: ${w}\n`);
  const ch = chClient(requireStoreUrl(cfg, 'clickhouseUrl'));
  const postgresUrl = requireStoreUrl(cfg, 'postgresUrl');
  const control = new PostgresControlStore(postgresUrl, () => ownerUrl(postgresUrl));
  const raw = new ClickHouseRawStore(ch);
  try {
    if (args.action === 'prune-control') {
      const rawDays = await raw.rawDays();
      if (rawDays.length === 0 && !args.allowEmptyRaw)
        throw new ConfigRejectedError(
          'tag_raw에 남은 UTC 일이 없다 — 정리하면 과거 대조군 일 파티션이 전부 지워진다. 의도했으면 --allow-empty-raw',
        );
      const before = (await control.partitions()).length;
      const dropped = await control.prune(rawDays, Date.now());
      const out = {
        at: new Date().toISOString(),
        mode: 'D',
        action: 'prune-control',
        rawDays,
        controlPartitionsBefore: before,
        dropped,
        ...runInfo(cfg),
      };
      process.stdout.write(`${JSON.stringify(out)}\n`);
      return;
    }
    if (cfg.capacityTier && cfg.capacityTier !== args.tier)
      throw new ConfigRejectedError(`--tier ${args.tier}가 CAPACITY_TIER ${cfg.capacityTier}와 다르다`);
    assertInRetention(args.fromMs, args.toMs, Date.now());
    const tags = await loadTags(postgresUrl, args);
    const periodMs = periodMsOf(args.tier);
    const workers = cfg.workerPoolSize;
    const pool = new Piscina({
      filename: resolve(__dirname, 'modules/datagen/mode-d/mode-d-worker.js'),
      minThreads: workers,
      maxThreads: workers,
    });
    try {
      const tuning = { ...DEFAULT_TUNING, periodMs, chunks: workers * 2 };
      const runner = new ModeDRunner(args, tags, tuning, poolOf(pool), raw, args.control ? control : null);
      const r = await runner.run();
      const options = {
        tier: args.tier,
        mix: args.mix,
        profile: args.profile,
        seed: args.seed,
        from: new Date(args.fromMs).toISOString(),
        to: new Date(args.toMs).toISOString(),
        control: args.control ? 'on' : 'off',
        rollup: args.rollup ? 'on' : 'off',
        devices: args.devices,
        tagsPerDevice: args.tagsPerDevice,
        periodMs,
        tierPointsPerSecond: CAPACITY_TIERS[args.tier].pointsPerSecond,
        workers,
        tuning,
      };
      const out = modeDOutput(new Date(), options, tags.tagIds.length, r, runInfo(cfg));
      process.stdout.write(`${JSON.stringify(out)}\n`);
      if (!r.allMatch) process.exitCode = 2;
    } finally {
      await pool.destroy();
    }
  } finally {
    await control.close();
    await ch.close();
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
