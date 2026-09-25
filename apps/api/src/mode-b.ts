// 모드 B 단독 실행 진입점(GEN-06 · S3 최소분) — Nest 없이 돈다(bench.ts와 같은 모양 · dist/mode-b.js).
// 사용: MEMORY_PROFILE=load node dist/mode-b.js --tier M --mix mixed --seed 42 --duration 60 [--pps N] [--undecodable-every N]
// 태그 집합은 PostgreSQL tag_master(POSTGRES_URL) · 발행은 DurableKeyClient(REDIS_URL) · MAXLEN은 MEMORY_PROFILE(requireStreamMaxlen).
// 출력은 JSON 한 줄 — 생성 · 발행 · 중단 · 해독 불가 주입 수 + run · switches(측정 기록 4요소 · 손으로 적지 않는다).
// 한 번에 한 모드(REQ-GEN-05) — 모드 A가 도는 api와 동시에 돌리지 않는 것은 실행자의 조건이다(이 진입점은 가를 수 없다).
import 'reflect-metadata';
import { CAPACITY_TIERS } from '@db-study/shared';
import { Client } from 'pg';
import { RedisConnections } from './common/redis/connections';
import { DurableKeyClient } from './common/redis/durable-key-client';
import {
  ConfigRejectedError,
  loadConfig,
  requireStoreUrl,
  requireStreamMaxlen,
  runInfo,
} from './config/app-config';
import { BackpressureGate, thresholdsFor } from './modules/datagen/mode-b/backpressure-gate';
import { ModeBGenerator } from './modules/datagen/mode-b/mode-b-generator';
import {
  assertTierShape,
  groupTags,
  MODE_B_TAG_SELECT,
  parseModeBArgs,
  stepsPerSecond,
} from './modules/datagen/mode-b/mode-b-options';
import { ModeBRunner } from './modules/datagen/mode-b/mode-b-runner';

async function main() {
  const cfg = loadConfig();
  const args = parseModeBArgs(process.argv);
  if (cfg.capacityTier && cfg.capacityTier !== args.tier)
    throw new ConfigRejectedError(`--tier ${args.tier}가 CAPACITY_TIER ${cfg.capacityTier}와 다르다`);
  // 조합 제약(02_features/13) — #2는 경로가 정의되지 않아 거부 · #8 · #9는 측정이 무의미해지는 조합이라 경고(기록 판정이 거른다)
  if (cfg.switches['SW-01'] === 'off')
    throw new ConfigRejectedError('SW-01 off + 모드 B는 조합 금지(#2) — Stream을 끈 구성에 Stream 직결 주입');
  if (cfg.switches['SW-10'] === 'on')
    process.stderr.write('경고: SW-10 on + 모드 B는 조합 금지(#8) — 데드밴드는 Collector 안에서만 돈다\n');
  if (cfg.switches['SW-11'] === 'collector')
    process.stderr.write('경고: SW-11 collector + 모드 B는 조합 금지(#9) — rt:latest를 쓰는 주체가 없다\n');
  for (const w of cfg.switchWarnings) process.stderr.write(`경고: ${w}\n`);
  const maxlen = requireStreamMaxlen(cfg);
  const gate = new BackpressureGate(thresholdsFor(maxlen));
  const postgresUrl = requireStoreUrl(cfg, 'postgresUrl');

  const pg = new Client({ connectionString: postgresUrl });
  await pg.connect();
  let devices: ReturnType<typeof groupTags>;
  try {
    devices = groupTags((await pg.query(MODE_B_TAG_SELECT, [true])).rows);
  } finally {
    await pg.end();
  }
  assertTierShape(devices, args.tier);
  const gen = new ModeBGenerator(devices, args.mix, args.seed);
  const pps = args.pps ?? CAPACITY_TIERS[args.tier].pointsPerSecond;
  const steps = stepsPerSecond(pps, gen.tagCount);

  const conns = new RedisConnections(cfg);
  try {
    await conns.ready();
    const runner = new ModeBRunner(
      gen,
      new DurableKeyClient(conns),
      {
        stepsPerSecond: steps,
        durationSeconds: args.durationSeconds,
        maxlen,
        undecodableEvery: args.undecodableEvery,
      },
      gate,
    );
    const result = await runner.run();
    const out = {
      at: new Date().toISOString(),
      mode: 'B',
      options: { ...args, pps, stepsPerSecond: steps, maxlen, thresholds: gate.thresholds },
      devices: devices.length,
      tags: gen.tagCount,
      result,
      ...runInfo(cfg),
    };
    process.stdout.write(`${JSON.stringify(out)}\n`);
  } finally {
    await conns.onApplicationShutdown();
  }
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
