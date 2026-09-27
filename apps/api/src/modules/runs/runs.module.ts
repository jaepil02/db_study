// 라이브 실행 제어(RunControlModule · GEN 소유) — api · all 역할에서만 기동(04_architecture/02 §APP_ROLE 배정)
// 표면을 받는 프로세스가 실행을 들고 있어야 중단 · 조회가 같은 메모리를 본다(06_pipeline/10 §라이브 실행).
// 부팅 정리: 남은 실행 수명 객체(plc.run_perf_raw · run_perf_raw)를 이름으로 찾아 DROP IF EXISTS — 크래시가 정리를 못 한 경우의 안전장치.
// 의존: ClickHouse · Postgres · DurableKeyClient(전역 저장소 모듈) · BIZ_WRITE_PORT(BizWriteModule @Global).
import { type ClickHouseClient, createClient } from '@clickhouse/client';
import { DEMO_FLOW } from '@db-study/shared';
import {
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Postgres } from '../../common/postgres/postgres.module';
import { DurableKeyClient } from '../../common/redis/durable-key-client';
import { WorkerPool } from '../../common/workers/worker-pool';
import { type AppConfig, requireStoreUrls, requireStreamMaxlen } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { BIZ_WRITE_PORT, type BizWritePort } from '../biz/biz-contracts';
import { INGEST_GROUP, RAW_STREAM } from '../collector/redis-stream-buffer';
import { thresholdsFor } from '../datagen/mode-b/backpressure-gate';
import { groupTags, MODE_B_TAG_SELECT } from '../datagen/mode-b/mode-b-options';
import type { FlowSecondResult, FlowSecondTask, FlowTag } from './flow-gen';
import { type DemoRows, type FlowDeps, FlowRunExecutor } from './flow-runner';
import { PerfRunExecutor } from './perf-runner';
import { dropPerfObjects, LivePerfStores } from './perf-stores';
import { RunRegistry } from './run-registry';
import { RUN_REGISTRY, RunsController } from './runs.controller';

/** perf 채우기(10^8 INSERT … SELECT)는 수 분 이상 — 공용 클라이언트(요청 상한 10초)와 따로 둔다 */
export const PERF_CH_REQUEST_TIMEOUT_MS = 3_600_000;
export const PERF_CH_CLIENT = Symbol('PerfClickHouseClient');

export function perfClickHouseClient(cfg: AppConfig): ClickHouseClient {
  const url = new URL(requireStoreUrls(cfg).clickhouseUrl);
  return createClient({
    url: `${url.protocol}//${url.host}`,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'plc',
    request_timeout: PERF_CH_REQUEST_TIMEOUT_MS,
    application: 'db_study-run-perf',
  });
}

/** 시연 전용 행을 코드로 찾는다(읽기 — 풀 app_rw) */
export async function findDemoRows(pg: Postgres, siteIdHint?: number | null): Promise<DemoRows> {
  const site =
    siteIdHint ??
    ((await pg.pool.query('SELECT site_id FROM site WHERE site_code = $1', [DEMO_FLOW.siteCode])).rows[0]
      ?.site_id as number | undefined) ??
    null;
  const line =
    site === null
      ? null
      : ((
          await pg.pool.query('SELECT line_id FROM production_line WHERE site_id = $1 AND line_code = $2', [
            site,
            DEMO_FLOW.lineCode,
          ])
        ).rows[0]?.line_id ?? null);
  const dev = (
    await pg.pool.query('SELECT device_id, is_active FROM device WHERE device_code = $1', [
      DEMO_FLOW.deviceCode,
    ])
  ).rows[0] as { device_id: number; is_active: boolean } | undefined;
  return {
    siteId: site === null ? null : Number(site),
    lineId: line === null ? null : Number(line),
    deviceId: dev ? Number(dev.device_id) : null,
    deviceActive: dev ? Boolean(dev.is_active) : null,
  };
}

/**
 * 한 초 생성 · 인코딩은 worker_threads(piscina 작업 flowSecond) — 50,000 pps를 api 이벤트 루프에서 만들면 조회 · WebSocket이 틱마다 멈춘다.
 * 워커가 돌려준 Buffer는 구조적 복제로 Uint8Array가 되어 돌아온다 — XADD 전에 Buffer 뷰로 되돌린다(복사 없음).
 */
export function workerFlowEncoder(workers: WorkerPool): (task: FlowSecondTask) => Promise<FlowSecondResult> {
  return async (task) => {
    const r = await workers.run<FlowSecondResult>(task, 'flowSecond');
    return {
      ...r,
      payloads: (r.payloads as Uint8Array[]).map((p) =>
        Buffer.isBuffer(p) ? p : Buffer.from(p.buffer, p.byteOffset, p.byteLength),
      ),
    };
  };
}

export function flowDepsFor(
  cfg: AppConfig,
  pg: Postgres,
  durable: DurableKeyClient,
  port: BizWritePort,
  workers: WorkerPool,
): FlowDeps {
  return {
    async loadTags(): Promise<FlowTag[]> {
      const devices = groupTags((await pg.pool.query(MODE_B_TAG_SELECT, [true])).rows);
      return devices.flatMap((d) => d.tagIds.map((tagId) => ({ deviceId: d.deviceId, tagId })));
    },
    findDemo: (siteId) => findDemoRows(pg, siteId),
    port,
    backlog: () => durable.groupBacklog(RAW_STREAM, INGEST_GROUP),
    xaddBatch: (payloads) =>
      durable.xaddBatchWithBacklog(RAW_STREAM, payloads, requireStreamMaxlen(cfg), INGEST_GROUP),
    thresholds: () => thresholdsFor(requireStreamMaxlen(cfg)),
    encode: workerFlowEncoder(workers),
  };
}

@Injectable()
export class RunsLifecycle implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('RunControl');

  constructor(
    @Inject(PERF_CH_CLIENT) private readonly ch: ClickHouseClient,
    private readonly pg: Postgres,
  ) {}

  /**
   * 부팅 정리 — ClickHouse DROP IF EXISTS + SELECT run_perf_drop()(마이그레이션 010 · app_rw EXECUTE).
   * 실패해도 기동을 막지 않는다(경고 로그) — 다음 perf prepare가 남은 객체를 보면 failed로 드러나고 그 실행의 정리가 지운다.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await dropPerfObjects(this.ch, this.pg.pool);
      this.log.log('부팅 정리 — 실행 수명 객체 DROP IF EXISTS 완료');
    } catch (e) {
      this.log.warn(`부팅 정리 실패 — ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.ch.close();
  }
}

@Module({
  controllers: [RunsController],
  providers: [
    { provide: PERF_CH_CLIENT, useFactory: perfClickHouseClient, inject: [APP_CONFIG] },
    {
      provide: RUN_REGISTRY,
      useFactory: (
        cfg: AppConfig,
        ch: ClickHouseClient,
        pg: Postgres,
        durable: DurableKeyClient,
        port: BizWritePort,
        workers: WorkerPool,
      ) =>
        new RunRegistry([
          new PerfRunExecutor(new LivePerfStores(ch, requireStoreUrls(cfg).postgresUrl, pg.pool)),
          new FlowRunExecutor(flowDepsFor(cfg, pg, durable, port, workers)),
        ]),
      inject: [APP_CONFIG, PERF_CH_CLIENT, Postgres, DurableKeyClient, BIZ_WRITE_PORT, WorkerPool],
    },
    RunsLifecycle,
  ],
})
export class RunsModule {}
