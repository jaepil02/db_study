import { Global, Module } from '@nestjs/common';
import { CollectDefinitionModule } from '../collector/collect-definition.module';
import { CollectorModule } from '../collector/collector.module';
import { DatagenModeAModule } from '../datagen/mode-a/mode-a.module';
import { PlcSimModule } from '../plc-sim/plc-sim.module';
import { PlantRuntime } from './plant-runtime.service';

/**
 * 설비 가동 적용(수집기 역할 all · collector) — SIM · 모드 A · COL을 켜고 끈다.
 * 전역이라 health · HMI 개요가 @Optional로 PlantRuntime을 찾는다 — 수집기가 없는 역할(api · worker)에서는 없다.
 */
@Global()
@Module({
  imports: [CollectDefinitionModule, PlcSimModule, DatagenModeAModule, CollectorModule],
  providers: [PlantRuntime],
  exports: [PlantRuntime],
})
export class PlantRuntimeModule {}
