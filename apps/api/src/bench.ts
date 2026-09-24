// 생성기 모듈 단독 실행 경로(S1 · GEN-09 · EXP-21) — 수집 경로 없이 생성 + MessagePack 인코딩 처리량을 잰다.
// 사용: APP_ROLE=datagen WORKER_POOL_SIZE=2 CAPACITY_TIER=M node dist/bench.js --mix mixed --seed 42 --warmup 5 --duration 30
// 생성 티어는 CAPACITY_TIER(설정 로더)에서만 읽는다 — 기록의 run.capacityTier와 실제 생성 규모가 한 원천에서 나온다.
// 출력은 JSON 한 줄 — run · switches는 설정 로더가 만든다(측정 기록 4요소 · 손으로 적지 않는다).
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig, runInfo } from './config/app-config';
import { DatagenService } from './modules/datagen/datagen.service';
import { parseMix } from './modules/datagen/signal/assignment';

function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? def) : def;
}

/** 정수 인자 — 범위 밖 · 소수 · NaN이면 거부한다(기록한 값과 실제 값이 어긋나지 않게) */
function intArg(name: string, def: string, min: number, max: number): number {
  const v = Number(arg(name, def));
  if (!Number.isInteger(v) || v < min || v > max)
    throw new Error(`--${name} ${arg(name, def)} — ${min}~${max} 정수`);
  return v;
}

async function main() {
  const cfg = loadConfig();
  if (cfg.appRole !== 'datagen') throw new Error('단독 실행 경로는 APP_ROLE=datagen으로만 돈다');
  const tier = cfg.capacityTier;
  if (!tier) throw new Error('CAPACITY_TIER가 없다 — 생성 티어와 기록 4요소의 원천이다');
  if (process.argv.includes('--tier') && arg('tier', '') !== tier) {
    throw new Error(`--tier ${arg('tier', '')}가 CAPACITY_TIER ${tier}와 다르다`);
  }
  for (const w of cfg.switchWarnings) process.stderr.write(`경고: ${w}\n`);
  const opts = {
    tier,
    mix: parseMix(arg('mix', 'mixed')),
    seed: intArg('seed', '42', 0, 4_294_967_295), // 난수는 32비트 시드를 쓴다
    warmupMs: intArg('warmup', '5', 0, 3600) * 1000,
    durationMs: intArg('duration', '30', 1, 3600) * 1000,
    stepsPerTask: intArg('steps', '10', 1, 100_000),
    chunks: intArg('chunks', '10', 1, 10_000),
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
