// 생성기 모듈 단독 실행 경로(S1 · GEN-09 · EXP-21) — 수집 경로 없이 생성 + MessagePack 인코딩 처리량을 잰다.
// 사용: APP_ROLE=datagen WORKER_POOL_SIZE=2 node dist/bench.js --tier M --mix mixed --seed 42 --warmup 5 --duration 30
// 출력은 JSON 한 줄 — run · switches는 설정 로더가 만든다(측정 기록 4요소 · 손으로 적지 않는다).
import 'reflect-metadata';
import { CAPACITY_TIER_NAMES, type CapacityTier } from '@db-study/shared';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig, runInfo } from './config/app-config';
import { DatagenService } from './modules/datagen/datagen.service';
import { parseMix } from './modules/datagen/signal/assignment';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}

async function main() {
  const cfg = loadConfig();
  if (cfg.appRole !== 'datagen') throw new Error('단독 실행 경로는 APP_ROLE=datagen으로만 돈다');
  const tier = arg('tier', 'M') as CapacityTier;
  if (!CAPACITY_TIER_NAMES.includes(tier)) throw new Error(`티어 ${tier} — S · M · M+ · L`);
  const opts = {
    tier,
    mix: parseMix(arg('mix', 'mixed')),
    seed: Number(arg('seed', '42')),
    warmupMs: Number(arg('warmup', '5')) * 1000,
    durationMs: Number(arg('duration', '30')) * 1000,
    stepsPerTask: Number(arg('steps', '10')),
    chunks: Number(arg('chunks', '10')),
  };
  const app = await NestFactory.createApplicationContext(AppModule.forConfig(cfg), {
    logger: ['error', 'warn'],
  });
  const svc = app.get(DatagenService);
  const result = await svc.runBench(opts);
  const out = {
    at: new Date().toISOString(),
    workers: cfg.workerPoolSize,
    options: opts,
    result,
    ...runInfo(cfg),
  };
  process.stdout.write(`${JSON.stringify(out)}\n`);
  await app.close();
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
