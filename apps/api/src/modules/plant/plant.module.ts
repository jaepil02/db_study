import { Module } from '@nestjs/common';
import { PlantController } from './plant.controller';
import { PlantOverviewService } from './plant-overview.service';
import { PlantPowerModule } from './plant-power.module';

/**
 * 설비 가동 · HMI 개요 표면(D-16 결정 3) — HTTP 표면이라 api · all 역할만 싣는다.
 * PLANT_POWER_PORT를 다시 내보낸다 — imports: [PlantModule]로도 주입받는다(PlantPowerModule이 전역이라 import 없이도 된다).
 * 실제 켜고 끄기는 수집기 역할의 PlantRuntimeModule이 한다.
 */
@Module({
  imports: [PlantPowerModule],
  controllers: [PlantController],
  providers: [PlantOverviewService],
  exports: [PlantPowerModule],
})
export class PlantModule {}
