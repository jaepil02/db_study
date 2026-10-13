// 라이브 실행 제어(RunControlModule · GEN 소유) — api · all 역할에서만 기동(04_architecture/02 §APP_ROLE 배정)
// 표면을 받는 프로세스가 실행을 들고 있어야 중단 · 조회가 같은 메모리를 본다(06_pipeline/10 §라이브 실행).
// 실행 종류 둘 — flow(직접 보내 보기) · compare(직접 비교 — 같은 센서 데이터를 Redis로 두 DB에 · D-16). 옛 perf 실행은 D-16에서 삭제.
// 같은 모듈이 직접 비교 결과 보관(run_result · GET /api/v1/runs/latest)과 센서 데이터 현황 · 지우기(/api/v1/data/sensor) 표면을 갖는다.
// 의존: Postgres · ClickHouse · Redis 래퍼 둘(전역 저장소 모듈) · BIZ_WRITE_PORT(BizWriteModule @Global) · PLANT_POWER_PORT(PlantPowerModule @Global) ·
// SwitchRegistry(PortsModule — 결과에 남길 스위치 값).
// 조회 섞기: TimeseriesService · RealtimeService · MasterReadService를 ModuleRef(strict false)로 같은 인스턴스를 찾아 부른다 —
// 표면 모듈(TSQ · RLT)이 서비스를 내보내지 않아도 표면과 같은 싱글턴 · 같은 스위치 포트 구현을 탄다(api · all 역할에 함께 실린다).
import type { ClickHouseClient } from '@clickhouse/client';
import { DEMO_FLOW } from '@db-study/shared';
import { Inject, Injectable, Module, type OnApplicationShutdown, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ClickHouse } from '../../common/clickhouse/clickhouse.module';
import { SwitchRegistry } from '../../common/ports/switch-registry';
import { Postgres } from '../../common/postgres/postgres.module';
import { CacheKeyClient } from '../../common/redis/cache-key-client';
import { DurableKeyClient } from '../../common/redis/durable-key-client';
import { WorkerPool } from '../../common/workers/worker-pool';
import { type AppConfig, INGEST_BATCH_PLANS, requireStreamMaxlen } from '../../config/app-config';
import { APP_CONFIG } from '../../config/config.module';
import { BIZ_WRITE_PORT, type BizWritePort } from '../biz/biz-contracts';
import { INGEST_GROUP, RAW_STREAM } from '../collector/redis-stream-buffer';
import { controlCopyTimeoutMs } from '../ingest/control-table-sink.port';
import { MasterReadService } from '../master/master-read.service';
import { PLANT_POWER_PORT, type PlantPowerPort } from '../plant/plant-power.port';
import { PlantRuntime } from '../plant/plant-runtime.service';
import { SensorPurgeLock } from '../plant/sensor-purge-lock';
import { RealtimeService } from '../realtime/realtime.service';
import { TimeseriesService } from '../timeseries/timeseries.service';
import { thresholdsFor } from './backpressure-gate';
import { meterSnapshot } from './compare-metrics';
import { type CompareDeps, CompareRunExecutor } from './compare-runner';
import { adminClickHouse, type CompareStores, LiveCompareStores, LiveSensorStores } from './compare-stores';
import type { DemoRows } from './demo-rows';
import type { FlowSecondResult, FlowSecondTask } from './flow-gen';
import { type FlowDeps, type FlowReads, FlowRunExecutor } from './flow-runner';
import { RunRegistry } from './run-registry';
import { PgRunResultStore, RUN_RESULTS, type RunResultStore } from './run-result';
import { RUN_REGISTRY, RunsController } from './runs.controller';
import { SENSOR_DATA, SensorDataController, SensorDataService } from './sensor-data';

/** flow 발행 대상 후보 — 시연 전용 설비의 태그 전부(코드로 flow 전용 태그를 가른다 · demo-rows.ensureFlowTags) */
export const DEMO_TAG_SELECT = 'SELECT tag_id, tag_code FROM tag_master WHERE device_id = $1 ORDER BY tag_id';

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

/**
 * 조회 섞기 — 표면 컨트롤러가 부르는 메서드 그대로(시계열 #1 · 최신값 #1 · 설비 목록 #2). 찾기는 호출 때 한다 —
 * 팩토리 시점에는 다른 모듈의 인스턴스가 아직 없을 수 있다. 설비 목록은 비활성 포함(시연 설비가 비활성이다 · 사본 키는 같다).
 */
export function flowReadsFor(ref: ModuleRef): FlowReads {
  const get = <T>(t: Type<T>): T => ref.get(t, { strict: false });
  return {
    series: (q) => get(TimeseriesService).query(q),
    latest: (deviceId) => get(RealtimeService).deviceLatest(deviceId),
    devices: (siteId) => get(MasterReadService).listDevices(siteId, true),
  };
}

export function flowDepsFor(
  cfg: AppConfig,
  pg: Postgres,
  durable: DurableKeyClient,
  port: BizWritePort,
  workers: WorkerPool,
  reads: FlowReads,
): FlowDeps {
  return {
    async loadDemoTags(deviceId) {
      const rs = await pg.pool.query<{ tag_id: number; tag_code: string }>(DEMO_TAG_SELECT, [deviceId]);
      return rs.rows.map((r) => ({ tagId: Number(r.tag_id), tagCode: r.tag_code }));
    },
    findDemo: (siteId) => findDemoRows(pg, siteId),
    port,
    backlog: () => durable.groupBacklog(RAW_STREAM, INGEST_GROUP),
    xaddBatch: (payloads) =>
      durable.xaddBatchWithBacklog(RAW_STREAM, payloads, requireStreamMaxlen(cfg), INGEST_GROUP),
    thresholds: () => thresholdsFor(requireStreamMaxlen(cfg)),
    encode: workerFlowEncoder(workers),
    reads,
  };
}

/** 직접 비교의 관리 ClickHouse 클라이언트(긴 제한 시간) — 종료 때 닫는다 */
@Injectable()
export class CompareAdminClickHouse implements OnApplicationShutdown {
  readonly client: ClickHouseClient;
  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.client = adminClickHouse(cfg);
  }
  async onApplicationShutdown() {
    await this.client.close();
  }
}

/** 스위치 값만(health switches의 value) — 결과 보관 · 기록 조건 */
export function switchValues(reg: SwitchRegistry): Record<string, string | number> {
  return Object.fromEntries(Object.entries(reg.snapshot()).map(([id, sw]) => [id, sw.value]));
}

export function compareDepsFor(
  cfg: AppConfig,
  stores: CompareStores,
  results: RunResultStore,
  plant: PlantPowerPort,
  reg: SwitchRegistry,
): CompareDeps {
  return {
    stores,
    results,
    meter: meterSnapshot,
    plantOn: () => plant.isOn(),
    switches: () => switchValues(reg),
    commitHash: cfg.commitHash,
    sw09: cfg.switches['SW-09'],
    copyTimeoutMs: controlCopyTimeoutMs(INGEST_BATCH_PLANS[cfg.ingestBatchPlan].windowMs),
  };
}

const COMPARE_STORES = Symbol('CompareStores');

@Module({
  controllers: [RunsController, SensorDataController],
  providers: [
    CompareAdminClickHouse,
    {
      provide: RUN_RESULTS,
      useFactory: (pg: Postgres) => new PgRunResultStore(pg.pool),
      inject: [Postgres],
    },
    {
      provide: COMPARE_STORES,
      useFactory: (
        cfg: AppConfig,
        pg: Postgres,
        ch: ClickHouse,
        admin: CompareAdminClickHouse,
        durable: DurableKeyClient,
        cache: CacheKeyClient,
      ) => new LiveCompareStores(cfg, pg.pool, ch.client, admin.client, durable, cache),
      inject: [APP_CONFIG, Postgres, ClickHouse, CompareAdminClickHouse, DurableKeyClient, CacheKeyClient],
    },
    {
      provide: RUN_REGISTRY,
      useFactory: (
        cfg: AppConfig,
        pg: Postgres,
        durable: DurableKeyClient,
        port: BizWritePort,
        workers: WorkerPool,
        ref: ModuleRef,
        stores: CompareStores,
        results: RunResultStore,
        plant: PlantPowerPort,
        reg: SwitchRegistry,
        lock: SensorPurgeLock,
      ) =>
        new RunRegistry(
          [
            new FlowRunExecutor(flowDepsFor(cfg, pg, durable, port, workers, flowReadsFor(ref))),
            new CompareRunExecutor(compareDepsFor(cfg, stores, results, plant, reg)),
          ],
          undefined,
          () => lock.assertIdle(),
        ),
      inject: [
        APP_CONFIG,
        Postgres,
        DurableKeyClient,
        BIZ_WRITE_PORT,
        WorkerPool,
        ModuleRef,
        COMPARE_STORES,
        RUN_RESULTS,
        PLANT_POWER_PORT,
        SwitchRegistry,
        SensorPurgeLock,
      ],
    },
    {
      provide: SENSOR_DATA,
      useFactory: (
        pg: Postgres,
        admin: CompareAdminClickHouse,
        durable: DurableKeyClient,
        cache: CacheKeyClient,
        stores: CompareStores,
        results: RunResultStore,
        runs: RunRegistry,
        plant: PlantPowerPort,
        lock: SensorPurgeLock,
        runtime: PlantRuntime | null,
      ) =>
        new SensorDataService({
          stores: new LiveSensorStores(pg.pool, admin.client, durable, cache, stores, () =>
            results.lastIngest(),
          ),
          runActive: () => runs.active() !== null,
          plantOn: () => plant.isOn(),
          // 수집기가 이 프로세스에 있을 때만(APP_ROLE all · collector) — api 역할 하나면 원하는 상태만 본다
          plantRunning: () => (runtime ? runtime.running() : null),
          backlog: async () => {
            const b = await durable.groupBacklog(RAW_STREAM, INGEST_GROUP);
            return b ? (b.lag ?? 0) + b.pending : null;
          },
          lock,
        }),
      inject: [
        Postgres,
        CompareAdminClickHouse,
        DurableKeyClient,
        CacheKeyClient,
        COMPARE_STORES,
        RUN_RESULTS,
        RUN_REGISTRY,
        PLANT_POWER_PORT,
        SensorPurgeLock,
        { token: PlantRuntime, optional: true },
      ],
    },
  ],
})
export class RunsModule {}
