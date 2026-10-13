// APP_ROLE이 기동할 모듈 범위를 고른다 — 배정 정본 docs/04_architecture/02_module_boundaries.md §APP_ROLE 배정
// 모듈: SIM · COL · GEN(모드 A) · ING · RLT · TSQ · MST · 업무 명령 · 라이브 실행 · OBS · 설비 가동 · HMI 개요(알람 · 인증 · 측정 도구는 D-16에서 삭제).
// 설비 가동(D-16): 상태 읽기 · 쓰기(PlantPowerModule)는 모든 역할 · 표면(PlantModule)은 api · all · 적용(PlantRuntimeModule — SIM · 모드 A · COL 켜고 끄기)은 all · collector.
// 기능 선택은 모듈 초기화가 한다 — 경로 안 분기를 두지 않는다(ADR-08과 같은 원리).
import { type DynamicModule, Module } from '@nestjs/common';
import { ClickHouseModule } from './common/clickhouse/clickhouse.module';
import { FlowModule } from './common/flow/flow.module';
import { PortsModule, RealtimeFanoutModule } from './common/ports/ports.module';
import { PostgresModule } from './common/postgres/postgres.module';
import { RedisModule } from './common/redis/redis.module';
import { WorkerPoolModule } from './common/workers/worker-pool';
import type { AppConfig, AppRole } from './config/app-config';
import { ConfigModule } from './config/config.module';
import { BizWorkerModule } from './modules/biz/biz-worker.module';
import { BizWriteModule } from './modules/biz/biz-write.module';
import { CollectorModule } from './modules/collector/collector.module';
import { DatagenModeAModule } from './modules/datagen/mode-a/mode-a.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { MasterModule } from './modules/master/master.module';
import { MasterApiModule } from './modules/master/master-api.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PlantModule } from './modules/plant/plant.module';
import { PlantPowerModule } from './modules/plant/plant-power.module';
import { PlantRuntimeModule } from './modules/plant/plant-runtime.module';
import { PlcSimModule } from './modules/plc-sim/plc-sim.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RunsModule } from './modules/runs/runs.module';
import { TimeseriesModule } from './modules/timeseries/timeseries.module';

type Imports = NonNullable<DynamicModule['imports']>;

/** 역할별 도메인 모듈 — SIM · GEN 모드 A는 collector와 한 프로세스(ADR-22 · 루프백 · 프로세스 안 Buffer 갱신) */
const ROLE_MODULES: Record<AppRole, Imports> = {
  all: [
    MasterModule,
    MasterApiModule,
    PlcSimModule,
    DatagenModeAModule,
    CollectorModule,
    PlantRuntimeModule,
    IngestModule,
    RealtimeModule,
    TimeseriesModule,
    MetricsModule,
    BizWriteModule,
    BizWorkerModule,
    RunsModule,
    PlantModule,
  ],
  api: [
    MasterModule,
    MasterApiModule,
    RealtimeModule,
    TimeseriesModule,
    MetricsModule,
    BizWriteModule,
    // 라이브 실행 제어(EXP-FLOW) — api 역할 · 실행 상태는 인스턴스 메모리(07_api/09 §라이브 실행 제어)
    RunsModule,
    // 설비 가동 스위치 · HMI 개요 표면 — 적용은 collector 역할이 ctl:plant:power를 읽어 한다
    PlantModule,
  ],
  // 업무 명령 적용(grp:biz-writer · lock:biz:writer 단일 소비자)은 워커 역할 — 06_pipeline/07 §적용 단계
  worker: [IngestModule, MetricsModule, BizWorkerModule],
  collector: [
    MasterModule,
    PlcSimModule,
    DatagenModeAModule,
    CollectorModule,
    PlantRuntimeModule,
    MetricsModule,
  ],
};

@Module({})
export class AppModule {
  static forConfig(cfg: AppConfig): DynamicModule {
    const stores: Imports = [
      RedisModule,
      ClickHouseModule,
      PostgresModule,
      RealtimeFanoutModule,
      FlowModule,
      PlantPowerModule,
    ];
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
