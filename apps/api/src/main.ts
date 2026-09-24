// api 진입점(S2) — NestJS + Fastify 어댑터 + 네이티브 ws 어댑터(09_tech_stack/02 §런타임과 HTTP 계층)
// 기동 순서의 정본 docs/04_architecture/03_execution_topology.md §기동 순서 — 저장소 healthy 뒤 · 설정은 기동 시 1회.
import 'reflect-metadata';
import fastifyCors from '@fastify/cors';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import { collectDefaultMetrics } from 'prom-client';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/http/exception-filter';
import { installHttpMetrics } from './common/http/http-metrics';
import { corsDelegator, hostGuard } from './common/http/surface-defense';
import { appRegistry } from './common/metrics/registry';
import { ConfigRejectedError, loadConfig } from './config/app-config';

export const API_PORT = 3000;

async function main() {
  const cfg = loadConfig();
  if (cfg.appRole === 'datagen')
    throw new ConfigRejectedError('APP_ROLE=datagen은 HTTP 표면이 없다 — node dist/bench.js');
  collectDefaultMetrics({ register: appRegistry, eventLoopMonitoringPrecision: 10 });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forConfig(cfg),
    new FastifyAdapter({ trustProxy: false }),
  );
  app.useWebSocketAdapter(new WsAdapter(app));
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', hostGuard);
  installHttpMetrics(fastify);
  await app.register(fastifyCors, { delegator: corsDelegator });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  // 컨테이너 안 0.0.0.0 — 호스트 publish는 127.0.0.1:3000(Compose ports · ADR-18)
  await app.listen(API_PORT, '0.0.0.0');
  new Logger('main').log(`api 기동 — APP_ROLE ${cfg.appRole} · 커밋 ${cfg.commitHash ?? 'null'}`);
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
