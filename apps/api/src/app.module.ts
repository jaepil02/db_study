// APP_ROLE이 기동할 모듈 범위를 고른다 — 배정 정본 docs/04_architecture/02_module_boundaries.md §APP_ROLE 배정
// S2 모듈: SIM · COL · GEN(모드 A) · ING · RLT · TSQ · MST(조회 · 메타 사본) · OBS. 나머지 도메인은 그 도입 단계에서 이 표에 더한다.
// 기능 선택은 모듈 초기화가 한다 — 경로 안 분기를 두지 않는다(ADR-08과 같은 원리).
import { type DynamicModule, Module } from '@nestjs/common';
import { ClickHouseModule } from './common/clickhouse/clickhouse.module';
import { PortsModule } from './common/ports/ports.module';
import { PostgresModule } from './common/postgres/postgres.module';
import { RedisModule } from './common/redis/redis.module';
import { WorkerPoolModule } from './common/workers/worker-pool';
import type { AppConfig, AppRole } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { CollectorModule } from './modules/collector/collector.module';
import { DatagenModule } from './modules/datagen/datagen.module';
import { DatagenModeAModule } from './modules/datagen/mode-a/mode-a.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { MasterModule } from './modules/master/master.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PlcSimModule } from './modules/plc-sim/plc-sim.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TimeseriesModule } from './modules/timeseries/timeseries.module';

type Imports = NonNullable<DynamicModule['imports']>;

/** 역할별 도메인 모듈 — SIM · GEN 모드 A는 collector와 한 프로세스(ADR-22 · 루프백 · 프로세스 안 Buffer 갱신) */
const ROLE_MODULES: Record<AppRole, Imports> = {
  all: [
    MasterModule,
    PlcSimModule,
    DatagenModeAModule,
    CollectorModule,
    IngestModule,
    RealtimeModule,
    TimeseriesModule,
    MetricsModule,
  ],
  api: [MasterModule, RealtimeModule, TimeseriesModule, MetricsModule],
  worker: [IngestModule, MetricsModule],
  collector: [MasterModule, PlcSimModule, DatagenModeAModule, CollectorModule, MetricsModule],
  // 생성기 단독 실행 경로(S1 bench)는 저장소를 쓰지 않는다 — 모드 B · D는 S5에서 이 역할에 더한다
  datagen: [DatagenModule],
};

/** 저장소 접속이 필요 없는 역할 */
const STORELESS: ReadonlySet<AppRole> = new Set(['datagen']);

@Module({})
export class AppModule {
  static forConfig(cfg: AppConfig): DynamicModule {
    const stores: Imports = STORELESS.has(cfg.appRole) ? [] : [RedisModule, ClickHouseModule, PostgresModule];
    return {
      module: AppModule,
      imports: [
        ConfigModule.forConfig(cfg),
        WorkerPoolModule,
        PortsModule,
        ...stores,
        ...(ROLE_MODULES[cfg.appRole] ?? []),
      ],
    };
  }
}
